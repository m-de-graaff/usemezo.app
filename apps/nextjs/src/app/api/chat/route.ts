import { createCaller } from "@mezo/api";
import { BODY_PARTS, EQUIPMENT, searchExercises } from "@mezo/api/exercises";
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
import { proposedRoutine } from "~/lib/routine-proposal";

/**
 * Milo, the assistant behind `/milo`.
 *
 * Four tools and a system prompt. Two of them read: the profile, generated from
 * the same questionnaire the settings screens render, and the exercise
 * catalogue. Two of them propose, and neither writes.
 *
 * `proposeProfileUpdate` and `proposeRoutine` have no `execute`, so the model
 * can only put something on screen and the user's browser sends the answer
 * back. Both writes then go through the ordinary procedures, `profile.update`
 * and `workout.saveRoutine`, which is what keeps their validation the only
 * thing standing between a model's number and the database.
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

			searchExercises: tool({
				description:
					"Search the exercise catalogue. Call this before proposing a routine: it is the only place real exercise ids come from, and an id you invented is rejected before the user sees anything. Search by name, or filter by body part or equipment, or both.",
				inputSchema: z.object({
					query: z.string().optional().describe("Part of the exercise name."),
					bodyPart: z.enum(BODY_PARTS as [string, ...string[]]).optional(),
					equipment: z.enum(EQUIPMENT as [string, ...string[]]).optional(),
				}),
				// Twelve is enough to choose from and short enough not to fill the
				// context with a catalogue the model then has to re-read. The media
				// fields are dropped: a model has no use for a filename.
				execute: async ({ query, bodyPart, equipment }) =>
					searchExercises({ query, bodyPart, equipment, limit: 12 }).map(
						(exercise) => ({
							id: exercise.id,
							name: exercise.name,
							bodyPart: exercise.bodyPart,
							equipment: exercise.equipment,
							target: exercise.target,
						}),
					),
			}),

			// Deliberately no `execute`, the same as proposeProfileUpdate. The
			// stream stops here, the browser renders a card, and the user's answer
			// comes back as the tool result.
			proposeRoutine: tool({
				description:
					"Propose a routine for the user to save. This does not save anything: they see every exercise and set and press Save or Discard. Call searchExercises first and use the ids it gave you.",
				inputSchema: proposedRoutine,
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
		"## Building workouts",
		"You can propose a routine: a name and a list of exercises with sets, reps and a weight. proposeRoutine puts a card on screen and the user presses Save. It saves nothing by itself, so propose rather than announce, and never say a routine is saved until the tool result says it was.",
		"Always call searchExercises first and use the ids it gives you. There are over a thousand exercises and you do not know their ids; an invented one is rejected and the user sees nothing.",
		"Send weights in kilograms whatever units the conversation is in, the same rule as proposeProfileUpdate. Leave the weight out for a bodyweight movement, and leave it out rather than guess when you have nothing to base it on.",
		"Read the profile before proposing anything, so a routine respects what they have told you about their experience and their physical limitations.",
		"Six to eight exercises is a session. More than that is a wish list.",
		"",
		"## Manner",
		"Short, plain answers. No preamble, no restating the question. You are not a doctor: for anything that sounds like a symptom or a diagnosis, say so and suggest they ask one.",
	].join("\n");
}
