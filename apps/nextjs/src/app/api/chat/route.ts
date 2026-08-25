import { createCaller } from "@mezo/api";
import { threadTitle } from "@mezo/api/milo";
import { createTRPCContext } from "@mezo/api/trpc";
import { auth } from "@mezo/auth";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import {
	convertToModelMessages,
	stepCountIs,
	streamText,
	tool,
	type UIMessage,
} from "ai";
import { z } from "zod";
import { unitSystem } from "~/lib/measure";
import {
	describeField,
	formatAnswer,
	MILO_FIELDS,
	profileChange,
} from "~/lib/milo";

/**
 * Milo, the assistant behind `/milo`.
 *
 * Two tools and a system prompt, both generated from the same questionnaire the
 * settings screens render. Reads run here; writes do not — `proposeProfileUpdate`
 * has no `execute`, so the model can only put a change on screen and the user's
 * browser sends the answer back. The write itself goes through `profile.update`
 * like any other, which is what keeps `profileInput` the only thing standing
 * between a number and the database.
 */

export const maxDuration = 60;

/**
 * Ox Alpha through OpenRouter: free, a million tokens of context, and it
 * supports tool calling, which is the part Milo cannot do without.
 *
 * It is a cloaked model, so the provider behind it is not named and prompts
 * are logged for it. Milo's prompts carry body composition and health answers,
 * so this is a development choice rather than one to ship: swap the id for a
 * named model before this handles anyone's data but your own.
 */
const MODEL = "stealth/ox-alpha";

export async function POST(req: Request) {
	// Route handlers read the request's own headers rather than `headers()`,
	// which is what `/api/trpc` does and what keeps the cookie in reach.
	const session = await auth.api.getSession({ headers: req.headers });
	if (!session) {
		return new Response("Unauthorized", { status: 401 });
	}

	const apiKey = process.env.AI_OPEN_ROUTER_KEY;
	if (!apiKey) {
		return new Response(
			"Milo has no model behind it yet: set AI_OPEN_ROUTER_KEY in your .env.",
			{ status: 503 },
		);
	}

	const { id, messages }: { id?: string; messages: UIMessage[] } =
		await req.json();

	// One caller for the whole request, built from the same headers the session
	// came out of, so the tool and the prompt read one profile between them.
	const trpc = createCaller(() => createTRPCContext({ headers: req.headers }));
	const profile = await trpc.profile.get();

	const openrouter = createOpenRouter({ apiKey });

	const result = streamText({
		model: openrouter(MODEL),
		system: systemPrompt(profile, session.user.name),
		messages: await convertToModelMessages(messages),
		// A read, a reply, and room for a second look. Without a bound a tool loop
		// can spin on a model that keeps re-reading the same profile.
		stopWhen: stepCountIs(6),
		tools: {
			getProfile: tool({
				description:
					"Read the user's saved profile: body composition, measurements, goals, nutrition and health answers. Call this before answering anything about their numbers, and before proposing a change, so you are working from what is actually stored.",
				inputSchema: z.object({}),
				// Re-read rather than close over the row above: a change applied
				// mid-conversation has to be visible the next time Milo looks.
				execute: async () => readProfile(await trpc.profile.get()),
			}),

			// Deliberately no `execute`. The stream stops here, the browser renders a
			// card, and the user's answer comes back as the tool result.
			proposeProfileUpdate: tool({
				description:
					"Propose one or more changes to the user's profile. This does not save anything: the user sees each change and presses Apply or Discard. Send values in stored units (kilograms, centimetres) and option keys rather than labels, whatever units the conversation is in.",
				inputSchema: z.object({
					changes: z.array(profileChange).min(1).max(10),
				}),
			}),
		},
	});

	return result.toUIMessageStreamResponse({
		originalMessages: messages,
		onError: (error) =>
			error instanceof Error ? error.message : String(error),
		// Saved once the turn has finished streaming, so a cancelled or failed run
		// leaves whatever was already stored alone. `id` is absent only if a client
		// forgets to send one, and a conversation nobody can address again is not
		// worth a row.
		onFinish: async ({ messages: finished }) => {
			if (!id) return;
			try {
				await trpc.milo.save({
					id,
					title: threadTitle(firstUserText(finished)),
					messages: finished,
				});
			} catch (error) {
				// A failed save must not take the reply down with it: the user has
				// already read it, and losing the history is the smaller loss.
				console.error("[milo] could not save thread", id, error);
			}
		},
	});
}

/** The opening line of the conversation, which is what names it in the list. */
function firstUserText(messages: UIMessage[]) {
	const first = messages.find((message) => message.role === "user");
	return (first?.parts ?? [])
		.map((part) => (part.type === "text" ? part.text : ""))
		.join(" ");
}

/**
 * Every answer twice over: the stored metric value the model has to write back,
 * and the same value as the user reads it. Giving the model both is what stops
 * it converting units in its head, which is where a chatbot quietly turns 82 kg
 * into 82 lb.
 */
type Profile = Awaited<
	ReturnType<ReturnType<typeof createCaller>["profile"]["get"]>
>;

function readProfile(profile: Profile) {
	const system = unitSystem(profile.units);

	return {
		units: system,
		answers: MILO_FIELDS.map((field) => {
			const value = profile[field.name as keyof typeof profile] ?? null;
			return {
				field: field.name,
				label: field.label,
				stored: value,
				display: formatAnswer(field, value, system),
			};
		}),
	};
}

function systemPrompt(profile: Profile, name: string | undefined) {
	const system = unitSystem(profile.units);

	return [
		`You are Milo, the assistant inside Mezo, a health and training app.${name ? ` You are talking to ${name}.` : ""}`,
		"",
		"You help with training, food, sleep and body composition, and you can read and propose changes to the numbers the app has saved.",
		"",
		"## Units",
		`This user reads ${system === "imperial" ? "imperial units: feet and inches for height, pounds for weight" : "metric units: centimetres for height, kilograms for weight"}. Speak in those units. Every number you quote back to them should already be converted.`,
		"Mezo stores every measurement in metric regardless. When you call proposeProfileUpdate, send kilograms for mass and centimetres for length, never the display units. The app converts for the user.",
		"",
		"## Changing settings",
		"You cannot write to the profile. proposeProfileUpdate puts a card on screen and the user presses Apply. So propose changes rather than announcing them, and never claim something is saved until the tool result says it was applied.",
		"Call getProfile first if you are proposing a change to a value you have not read this conversation. Propose only what the user asked for, or what plainly follows from what they told you: if they say they measured 18% body fat, that is one change, not an invitation to recalculate their whole plan.",
		"Use the exact option keys listed below, not their labels.",
		"",
		"## Fields you can read and propose",
		...MILO_FIELDS.map((field) => `- ${describeField(field)}`),
		"",
		"## Manner",
		"Short, plain answers. No preamble, no restating the question. You are not a doctor: for anything that sounds like a symptom or a diagnosis, say so and suggest they ask one.",
	].join("\n");
}
