import { createAnthropic } from "@ai-sdk/anthropic";
import { createCaller } from "@mezo/api";
import { customExerciseInput } from "@mezo/api/exercise";
import {
	BODY_PARTS,
	customById,
	EQUIPMENT,
	type Exercise,
	exerciseById,
	loggingHint,
	searchExercises,
} from "@mezo/api/exercises";
import { NOTE_KINDS, threadTitle } from "@mezo/api/milo";
import { bodyComposition } from "@mezo/api/plan";
import {
	estimateLoad,
	type LiftRecord,
	patternOf,
	referenceLift,
} from "@mezo/api/strength";
import {
	auditVolume,
	coverage,
	isCompound,
	MUSCLES,
	musclesWorked,
	orderSession,
	redundancies,
	regionsOf,
	restFor,
} from "@mezo/api/training";
import { createTRPCContext } from "@mezo/api/trpc";
import { auth } from "@mezo/auth";
import {
	convertToModelMessages,
	stepCountIs,
	streamText,
	tool,
	UI_MESSAGE_STREAM_HEADERS,
	type UIMessage,
} from "ai";
import { RESUMABLE_STREAM_ID_HEADER } from "assistant-stream/resumable";
import { z } from "zod";
import { unitSystem } from "~/lib/measure";
import { formatAnswer, MILO_FIELDS, profileChange } from "~/lib/milo";
import { systemPrompt } from "~/lib/milo-prompt";
import { miloStreams } from "~/lib/milo-streams";
import { proposedRoutine } from "~/lib/routine-proposal";

/**
 * Milo, the assistant behind `/milo`.
 *
 * A handful of tools and a system prompt. Six of them read: the profile, the
 * exercise catalogue, what the user has actually been lifting, what a weight
 * should be, what is wrong with a session before anyone is asked to save it,
 * and the session they are training now. Three of them stop and wait for the
 * user. The rest write immediately — what Milo remembers, the notes on a
 * session, and the two edits a user can make to their own catalogue.
 *
 * `proposeProfileUpdate`, `proposeRoutine` and `askUser` have no `execute`, so
 * the model can only put something on screen and the user's browser sends the
 * answer back. Both writes then go through the ordinary procedures,
 * `profile.update` and `workout.saveRoutine`, which is what keeps their
 * validation the only thing standing between a model's number and the database.
 *
 * The training science is not in this file. It is in `@mezo/api/training` and
 * `@mezo/api/strength`, which the tools call and the prompt is generated from,
 * so a landmark changes in one place and reaches the model, the routine card
 * and the tests at once.
 */

export const maxDuration = 60;

/**
 * Claude Sonnet 5, from Anthropic directly.
 *
 * Milo's prompts carry body composition and health answers, so who sees them
 * matters. A named first-party model under a data policy somebody can read is
 * the point of this over a free cloaked model on an aggregator.
 *
 * It is also the reason the turns finish: the free tier this ran on before was
 * capped at fifty requests a day and twenty a minute, and one routine build
 * spends a dozen of them. Sonnet 5 has a 1M context window, no request cap, and
 * costs $2 per million input tokens and $10 per million output.
 */
const MODEL = "claude-sonnet-5";

/**
 * A cache breakpoint, for the two prefixes that are worth not paying for twice.
 *
 * Anthropic reads a request as tools, then the system prompt, then the
 * messages, and a breakpoint caches everything before it. Two of them are
 * placed below and they are the reason a routine build is affordable:
 *
 * 1. On the system prompt, which puts the tool schemas and every landmark,
 *    region and rep scheme behind one boundary. That is the largest fixed cost
 *    in the request and it is byte-identical on every step of every turn for a
 *    given user, so it is written once and read back at a tenth of the price
 *    for the fifteen steps after it.
 * 2. On the last message of the conversation as it arrives. Within a turn that
 *    prefix does not move while the model works through sixteen tool calls, and
 *    the next turn reads back everything said before it.
 *
 * Writing costs about a quarter more than not caching, so this is a loss on a
 * one-step turn and a large win on a sixteen-step one. Building a routine is
 * the sixteen-step one, and it is what Milo is for.
 */
const CACHED = {
	anthropic: { cacheControl: { type: "ephemeral" } },
} as const;

/**
 * Adaptive thinking, at `high` effort.
 *
 * `budget_tokens` is not an option on this model — it is rejected outright —
 * and the fixed-budget idea it came from is gone. Claude decides how long to
 * think per step instead, and `effort` sets the ceiling on that and on the
 * overall token spend. `high` is the default and the right one here: Milo
 * programmes against volume landmarks and a coverage audit, which is reasoning
 * worth paying for, and the cheaper tiers show up as sessions that skip the
 * review step.
 */
const THINKING = {
	anthropic: { thinking: { type: "adaptive" }, effort: "high" },
} as const;

/**
 * How many exercises one estimateWeight call may price.
 *
 * A session is six to eight movements, so twenty is generous. The cap is what
 * stops a loop asking for the whole catalogue one round trip at a time.
 */
const MAX_ESTIMATES = 20;

/**
 * How many web searches one turn may run.
 *
 * Each is billed separately from the tokens. Three is enough to check a claim
 * from more than one place and few enough that a wrong turn is cheap.
 */
const SEARCHES = 3;

export async function POST(req: Request) {
	// Route handlers read the request's own headers rather than `headers()`,
	// which is what `/api/trpc` does and what keeps the cookie in reach.
	const session = await auth.api.getSession({ headers: req.headers });
	if (!session) {
		return new Response("Unauthorized", { status: 401 });
	}

	const apiKey = process.env.ANTHROPIC_API_KEY;
	if (!apiKey) {
		return new Response(
			"Milo has no model behind it yet: set ANTHROPIC_API_KEY in your .env.",
			{ status: 503 },
		);
	}

	const { id, messages }: { id?: string; messages: UIMessage[] } =
		await req.json();

	// One caller for the whole request, built from the same headers the session
	// came out of, so the tool and the prompt read one profile between them.
	const trpc = createCaller(() => createTRPCContext({ headers: req.headers }));
	// Read together: the prompt needs both, and a note is small enough that
	// fetching it is cheaper than a tool call the model has to remember to make.
	const [profile, notes, catalogue] = await Promise.all([
		trpc.profile.get(),
		trpc.milo.notes(),
		trpc.exercise.catalogue(),
	]);

	/**
	 * The user's own layer over the exercise catalogue, re-read per tool call
	 * rather than closed over.
	 *
	 * Milo can add an exercise and blacklist one inside a single turn, and the
	 * next tool call has to see it. The copy above is only for the prompt, which
	 * is built once and cannot change mid-run.
	 */
	const mine = async () => {
		const now = await trpc.exercise.catalogue();
		return {
			custom: now.custom as Exercise[],
			byId: customById(now.custom as Exercise[]),
			hidden: new Set(now.hidden),
		};
	};

	const anthropic = createAnthropic({ apiKey });

	/**
	 * The id of this run's buffer, written onto the thread before a token is
	 * generated.
	 *
	 * Saving here rather than only at the end is what stops a question
	 * disappearing when somebody navigates away while Milo is thinking: the
	 * conversation on disk already contains what they asked, and the id says
	 * there is a reply on its way that a browser can be reconnected to.
	 */
	const streamId = crypto.randomUUID();
	if (id) {
		try {
			await trpc.milo.save({
				id,
				title: threadTitle(firstUserText(messages)),
				messages,
				activeStreamId: streamId,
			});
		} catch (error) {
			// Worth continuing without: the reply is the thing the user is waiting
			// for, and an unsaved question is the smaller loss.
			console.error("[milo] could not open thread", id, error);
		}
	}

	// The prompt travels as the first message rather than as `system`, which is
	// the only way to hang a cache breakpoint off it: the top-level field takes
	// no provider options. The model sees the same thing either way.
	const history = await convertToModelMessages(messages);

	const result = streamText({
		model: anthropic(MODEL),
		providerOptions: THINKING,
		messages: [
			{
				role: "system",
				content: systemPrompt(profile, session.user.name, notes, {
					custom: catalogue.custom as Exercise[],
					hidden: catalogue.hidden,
				}),
				providerOptions: CACHED,
			},
			...history.map((message, index) =>
				index === history.length - 1
					? {
							...message,
							providerOptions: { ...message.providerOptions, ...CACHED },
						}
					: message,
			),
		],
		// Building a routine properly is five tool calls before the proposal:
		// profile, training, a search per slot, the weights, the review. Then a
		// second review if the first one found a gap. Without room for all of
		// them the model gives up halfway and guesses.
		stopWhen: stepCountIs(16),
		tools: {
			getProfile: tool({
				description:
					"Read the user's saved profile: body composition, measurements, goals, nutrition and health answers. Call this before answering anything about their numbers, before proposing a change, and before building a routine.",
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

			// Also no `execute`: the question goes on screen with its answers as
			// buttons, and the run resumes with whichever one they pressed.
			askUser: tool({
				description:
					"Ask the user one question and wait for the answer. Use it when the answer would change what you build and you cannot read it from their profile or their training log: days per week, session length, equipment, injuries, priorities. Ask at most two before building something.",
				inputSchema: z.object({
					question: z
						.string()
						.trim()
						.min(1)
						.max(200)
						.describe("One question, in plain language."),
					options: z
						.array(z.string().trim().min(1).max(60))
						.min(2)
						.max(6)
						.describe(
							"The answers, as buttons. Cover the likely ones; the user can always type something else instead.",
						),
				}),
			}),

			searchExercises: tool({
				description:
					"Search the catalogue: the 1300 exercises Mezo ships plus the ones this user has added. Call this before proposing a routine, it is where real exercise ids come from, and an id you invented is rejected before the user sees anything. Search by name, or filter by body part or equipment, or both. Each result carries what it trains and how long to rest after it. Anything the user has blacklisted is left out, so if you cannot find a movement you expected, they may have hidden it. If nothing here is the exercise you want, use createExercise.",
				inputSchema: z.object({
					query: z.string().optional().describe("Part of the exercise name."),
					bodyPart: z.enum(BODY_PARTS as [string, ...string[]]).optional(),
					equipment: z.enum(EQUIPMENT as [string, ...string[]]).optional(),
				}),
				// Twelve is enough to choose from and short enough not to fill the
				// context with a catalogue the model then has to re-read. The media
				// fields are dropped: a model has no use for a filename.
				execute: async ({ query, bodyPart, equipment }) => {
					const { custom, hidden } = await mine();
					return searchExercises({
						query,
						bodyPart,
						equipment,
						custom,
						hidden,
						limit: 12,
					}).map((exercise) => {
						const { primary, secondary } = musclesWorked(exercise);
						return {
							id: exercise.id,
							name: exercise.name,
							equipment: exercise.equipment,
							primaryMuscle: primary,
							secondaryMuscles: secondary,
							// Which part of the muscle it reaches, so a gap
							// reviewSession reported can be filled with the movement
							// that actually fills it rather than another press.
							regions: regionsOf(exercise),
							compound: isCompound(exercise),
							restSec: restFor(exercise),
							// What its weight column means, when it does not mean what it
							// says. Handed over rather than left to be inferred: a model
							// that prices a dumbbell press as the pair is a model whose
							// first working set is twice what anybody can lift.
							logAs: loggingHint(exercise) ?? undefined,
							yours: !exercise.media || undefined,
						};
					});
				},
			}),

			getTraining: tool({
				description:
					"What this user has actually been lifting in the last four weeks: their best set per exercise, how often they trained, and how their weekly sets landed across the muscles. Call it before building anything for somebody who has trained before, and before saying anything about their volume.",
				inputSchema: z.object({}),
				execute: async () => {
					const training = await trpc.workout.training();
					return {
						...training,
						exercises: training.exercises.map((row) => ({
							...row,
							lastDoneAt: row.lastDoneAt.toISOString().slice(0, 10),
						})),
					};
				},
			}),

			estimateWeight: tool({
				description:
					"What to load, per exercise, for a given number of reps at a given reps-in-reserve. Uses their own logged sets first, carries a load across from a related movement second, and falls back to strength standards scaled by their profile. Never guess a working weight yourself; call this. Ask for every exercise in one call. Every weight it returns is what goes on the equipment: on a barbell, EZ bar or trap bar that is the plates only, never the bar, and that is also how this user logs and reads them.",
				inputSchema: z.object({
					exercises: z
						.array(
							z.object({
								exerciseId: z
									.string()
									.describe("An id from searchExercises. Never invent one."),
								reps: z
									.number()
									.int()
									.min(1)
									.max(50)
									.describe("The reps the working set is programmed for."),
								rir: z
									.number()
									.int()
									.min(0)
									.max(5)
									.optional()
									.describe("Reps left in reserve. Defaults to 2."),
							}),
						)
						.min(1)
						.max(MAX_ESTIMATES),
				}),
				execute: async ({ exercises }) => {
					const [current, training, { byId }] = await Promise.all([
						trpc.profile.get(),
						trpc.workout.training(),
						mine(),
					]);

					const history: LiftRecord[] = training.exercises.map((row) => ({
						exerciseId: row.exerciseId,
						weightKg: row.weightKg,
						reps: row.reps,
						at: row.lastDoneAt,
					}));

					return exercises.map((wanted) => {
						const estimate = estimateLoad({
							exerciseId: wanted.exerciseId,
							reps: wanted.reps,
							rir: wanted.rir,
							history,
							profile: current,
							custom: byId,
						});

						if (!estimate) {
							return {
								exerciseId: wanted.exerciseId,
								error: exerciseById(wanted.exerciseId, byId)
									? "Not enough in their profile to estimate this. Ask for their bodyweight, or ask them what they usually lift."
									: "No exercise with that id.",
							};
						}

						const exercise = exerciseById(wanted.exerciseId, byId);

						return {
							...estimate,
							name: exercise?.name,
							// The name a transfer came from, because "carried across
							// from exercise 0070" is not a sentence to show anybody.
							fromExercise: estimate.fromExerciseId
								? exerciseById(estimate.fromExerciseId, byId)?.name
								: undefined,
							// What the movement is measured against, so a number the
							// user disagrees with can be argued about.
							comparedTo: exercise
								? referenceLift(patternOf(exercise))
								: undefined,
						};
					});
				},
			}),

			reviewSession: tool({
				description:
					"Check a session before you propose it. Returns four things: weekly sets per muscle against this user's volume landmarks, which parts of each muscle are actually being loaded and which are not, any two exercises that are the same movement twice, and the order to run it in with both rest intervals per exercise: restSec between its own sets, restAfterSec before the next exercise. Fix whatever it reports, then propose. A muscle a set trains indirectly counts as half.",
				inputSchema: z.object({
					exercises: z
						.array(
							z.object({
								exerciseId: z.string(),
								sets: z.number().int().min(1).max(20),
							}),
						)
						.min(1)
						.max(40)
						.describe("The session, in whatever order you have it."),
					timesPerWeek: z
						.number()
						.int()
						.min(1)
						.max(7)
						.optional()
						.describe(
							"How often this list is trained in a week. Defaults to 1.",
						),
					reps: z
						.number()
						.int()
						.min(1)
						.max(50)
						.optional()
						.describe(
							"Roughly what the working sets are programmed for. Only changes the rest intervals.",
						),
					include: z
						.array(z.enum(MUSCLES))
						.optional()
						.describe(
							"Muscles to report even when the list does not train them, to check for a gap.",
						),
					prioritise: z
						.array(z.enum(MUSCLES))
						.optional()
						.describe(
							"What this user most wants to improve. Their exercises are ordered earlier.",
						),
				}),
				execute: async ({
					exercises,
					timesPerWeek,
					reps,
					include,
					prioritise,
				}) => {
					const [current, { byId }] = await Promise.all([
						trpc.profile.get(),
						mine(),
					]);

					return {
						volume: auditVolume(exercises, {
							timesPerWeek,
							experience: current.fitnessExperience,
							include,
							custom: byId,
						}),
						coverage: coverage(exercises, byId),
						redundant: redundancies(exercises, byId),
						order: orderSession(exercises, { prioritise, reps, custom: byId }),
					};
				},
			}),

			// Deliberately no `execute`, the same as proposeProfileUpdate. The
			// stream stops here, the browser renders a card, and the user's answer
			// comes back as the tool result.
			proposeRoutine: tool({
				description:
					"Propose a routine for the user to save. This does not save anything: they see every exercise and set and press Save or Discard. Call searchExercises, estimateWeight and reviewSession first, and give every exercise a rep range, a reps-in-reserve target and a rest interval.",
				inputSchema: proposedRoutine,
			}),

			/*
			 * The memory tools write immediately rather than putting a card up for
			 * approval, which is the opposite of every other write here.
			 *
			 * The reason is friction. A profile change moves a number somebody is
			 * training to, so it is worth a button. A note is a sentence, it is
			 * shown as it is written, and it can be deleted from the same screen in
			 * one tap. Asking permission for each one would mean either a wall of
			 * confirmations or, far more likely, a model that stops bothering.
			 */
			remember: tool({
				description:
					"Write something down about this user so it is still known in their next conversation. Use it when they say something durable about themselves that no profile field covers: what they are training towards, an injury or a piece of equipment they do not have, how they like to train. Do not use it for anything already in their profile, for a passing detail, or for what they asked you in this message.",
				inputSchema: z.object({
					kind: z
						.enum(NOTE_KINDS)
						.describe(
							"goal: what they are working towards. constraint: an injury, a limitation, missing equipment. preference: how they like to train. fact: anything else worth keeping.",
						),
					text: z
						.string()
						.trim()
						.min(3)
						.max(300)
						.describe(
							"One sentence, about them, in their own terms. 'Wants a V-taper' rather than 'the user has expressed interest in developing a V-taper physique'.",
						),
					replaces: z
						.string()
						.optional()
						.describe(
							"The id of a note this one supersedes, when they have changed their mind about something you already remember.",
						),
				}),
				execute: async ({ kind, text, replaces }) => {
					try {
						return await trpc.milo.remember({ kind, text, replaces });
					} catch (error) {
						// A full list or a rejected note is something the model can act
						// on. Throwing would take the whole reply down with it.
						return {
							error: error instanceof Error ? error.message : String(error),
						};
					}
				},
			}),

			forget: tool({
				description:
					"Delete something you were remembering, by its id. Use it when the user says it is no longer true, asks you to forget it, or when you need room for a note that matters more.",
				inputSchema: z.object({ id: z.string().min(1).max(64) }),
				execute: ({ id }) => trpc.milo.forget({ id }),
			}),

			/*
			 * The session notes write immediately, the same trade the memory and
			 * catalogue tools make.
			 *
			 * A note is a sentence on a session the user can open and edit in one
			 * tap, and it is almost always the last thing in a turn: "log that my
			 * shoulder went on the last set of pressing". A confirmation card in
			 * front of it would be a button between a sentence and the same
			 * sentence.
			 */
			getWorkout: tool({
				description:
					"Read the user's current or most recent training session: its name, when it was, what was in it, and any notes already on it. Call this before writing a note onto a session, because it is where the exercise ids come from.",
				inputSchema: z.object({}),
				execute: async () => {
					const [session, { byId }] = await Promise.all([
						trpc.workout.latest(),
						mine(),
					]);
					if (!session) return { session: null };

					return {
						id: session.id,
						name: session.name,
						live: session.finishedAt === null,
						startedAt: session.startedAt,
						note: session.note,
						exercises: session.exercises.map((entry) => ({
							exerciseId: entry.exerciseId,
							name: exerciseById(entry.exerciseId, byId)?.name ?? "Unknown",
							note: entry.note,
							sets: entry.sets,
						})),
					};
				},
			}),

			noteWorkout: tool({
				description:
					"Write a note onto a training session, on the session as a whole or on the exercises in it. Use it when the user tells you how something went, what hurt, what felt easy, or what to change next time. Call getWorkout first: it names the session you are about to write on and gives you the exercise ids. Notes are written immediately and the user can edit them on the session itself.",
				inputSchema: z.object({
					id: z
						.string()
						.min(1)
						.max(64)
						.optional()
						.describe(
							"The session id from getWorkout. Leave it out for the current or most recent one.",
						),
					note: z
						.string()
						.trim()
						.max(1000)
						.nullish()
						.describe(
							"The note on the session as a whole, in their terms. Null clears it. Leave it out to change only the exercise notes.",
						),
					exercises: z
						.array(
							z.object({
								exerciseId: z
									.string()
									.min(1)
									.max(64)
									.describe("An id from getWorkout, not from searchExercises."),
								note: z
									.string()
									.trim()
									.max(500)
									.describe(
										"What to record about this exercise. An empty string removes the note it has.",
									),
							}),
						)
						.max(50)
						.optional()
						.describe("Notes on single exercises within the session."),
				}),
				execute: async (input) => {
					try {
						const written = await trpc.workout.annotate(input);
						// The document is the logging screen's business, not the model's.
						// Handing it back whole would spend a page of tokens restating
						// sets nobody asked about.
						const { exercises: _document, ...result } = written;
						return result;
					} catch (error) {
						return {
							error: error instanceof Error ? error.message : String(error),
						};
					}
				},
			}),

			/*
			 * The catalogue tools write immediately, the same trade the memory
			 * tools make and for the same reason.
			 *
			 * Adding an exercise and blacklisting one are each a row the user can
			 * see on the picker and undo in a tap, and both come up in the middle
			 * of building something else. A confirmation card in front of each
			 * would put two extra presses between "I do Bayesian curls" and a
			 * routine that has one in it, and would teach the model to stop
			 * offering.
			 *
			 * Deleting a custom exercise is deliberately not a tool. It orphans
			 * every routine and finished session that used it, which is not a
			 * consequence to hand a model, and the picker offers it in one tap.
			 */
			createExercise: tool({
				description:
					"Add an exercise the catalogue does not have, so it can be programmed and logged like any other. Search first: this is for movements that genuinely are not there, like a Bayesian curl or a machine only their gym has, not for a name you could not find on the first try. Give it the name the user would recognise. It saves immediately and they can delete it.",
				inputSchema: customExerciseInput.extend({
					name: customExerciseInput.shape.name.describe(
						"What the movement is called, as a lifter would say it. 'Bayesian curl', not 'Cable Bicep Curl (Bayesian Variation)'.",
					),
					target: customExerciseInput.shape.target.describe(
						"The muscle it mainly trains, in the catalogue's own words: pectorals, lats, traps, delts, biceps, triceps, forearms, quads, hamstrings, glutes, calves, abs. Get this right, it is what every volume count keys off.",
					),
					secondary: customExerciseInput.shape.secondary.describe(
						"Muscles it also works, in the same vocabulary. Each counts as half a set. Leave it empty rather than guessing.",
					),
				}),
				execute: async (input) => {
					try {
						return await trpc.exercise.create(input);
					} catch (error) {
						// A full list or a rejected muscle name is something the model
						// can act on. Throwing would take the whole reply down with it.
						return {
							error: error instanceof Error ? error.message : String(error),
						};
					}
				},
			}),

			hideExercise: tool({
				description:
					"Blacklist an exercise so neither you nor the picker ever offers it again. Use it when the user says they will not do something, cannot do something, or have no way to do it. It leaves the routines and the history they already have alone, and they can undo it from the exercise picker.",
				inputSchema: z.object({
					exerciseId: z
						.string()
						.min(1)
						.max(64)
						.describe("An id from searchExercises. Never invent one."),
					reason: z
						.string()
						.trim()
						.max(200)
						.optional()
						.describe(
							"Why, in their words. 'Hurts my shoulder', 'no cable machine at my gym'.",
						),
				}),
				execute: async ({ exerciseId, reason }) => {
					try {
						return await trpc.exercise.hide({ exerciseId, reason });
					} catch (error) {
						return {
							error: error instanceof Error ? error.message : String(error),
						};
					}
				},
			}),

			unhideExercise: tool({
				description:
					"Take an exercise off the blacklist, when the user says they want it back. The blacklist is listed in your instructions with its ids.",
				inputSchema: z.object({ exerciseId: z.string().min(1).max(64) }),
				execute: ({ exerciseId }) => trpc.exercise.unhide({ exerciseId }),
			}),

			/*
			 * Anthropic's own web search, which runs on their side: the model
			 * issues the query, the results never reach this process, and the
			 * citations come back attached to the reply.
			 *
			 * This replaced a hand-rolled tool that asked a second model to search
			 * and summarise. That version needed its own request, its own timeout
			 * and its own parsing of somebody else's JSON, and it returned a
			 * summary of the sources rather than the sources. Deleting it is the
			 * best part of moving to a first-party provider.
			 *
			 * `maxUses` is a cost ceiling. Each search is billed, and a coach that
			 * searches five times to answer one question about a supplement has
			 * misunderstood the question.
			 */
			web_search: anthropic.tools.webSearch_20260209({ maxUses: SEARCHES }),
		},
	});

	const response = result.toUIMessageStreamResponse({
		originalMessages: messages,
		onError: (error) =>
			error instanceof Error ? error.message : String(error),
		// The whole conversation again once the turn is done, and the run marked
		// as over. `id` is absent only if a client forgets to send one, and a
		// conversation nobody can address again is not worth a row.
		onFinish: async ({ messages: finished }) => {
			if (!id) return;
			try {
				await trpc.milo.save({
					id,
					title: threadTitle(firstUserText(finished)),
					messages: finished,
					activeStreamId: null,
				});
			} catch (error) {
				// A failed save must not take the reply down with it: the user has
				// already read it, and losing the history is the smaller loss.
				console.error("[milo] could not save thread", id, error);
			}
		},
	});

	// A conversation with no id has nowhere to be resumed from, so it streams
	// the old way: one response, and it ends with the connection.
	const body = response.body;
	if (!id || !body) return response;

	/**
	 * The reply goes into the buffer first and reaches the browser from there.
	 *
	 * That indirection is the point. The producer is driven by the buffer rather
	 * than by whoever is reading it, so closing the tab stops a reader and not
	 * the run, and the reconnect endpoint can hand the same bytes to the next
	 * browser that asks from the beginning.
	 */
	const streamed = await miloStreams.run(streamId, () => body);

	return new Response(streamed, {
		headers: {
			...UI_MESSAGE_STREAM_HEADERS,
			// What the browser stores so it knows which run to ask for.
			[RESUMABLE_STREAM_ID_HEADER]: streamId,
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
	const derived = bodyComposition(profile);

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
		/*
		 * Worked out from the answers above rather than stored, and handed over
		 * separately so the difference is visible: these are the figures a scan
		 * prints that are arithmetic on the rest.
		 *
		 * The model needs them because the user reads them on their scan and will
		 * ask about them by name. It must not try to write them — there is no
		 * field to write, `proposeProfileUpdate` would reject the attempt, and
		 * the right answer is that they already follow from what is saved.
		 */
		derivedFromTheAbove: {
			note: "Computed, not stored. There are no fields for these and nothing can write them. Quote them freely; if the user asks you to save one, say it already follows from their weight, fat mass, bone mass and water.",
			fatFreeMassKg: derived.fatFreeMassKg,
			softLeanMassKg: derived.softLeanMassKg,
			intracellularWaterKg: derived.intracellularWaterKg,
			extracellularRatio: derived.extracellularRatio,
		},
	};
}
