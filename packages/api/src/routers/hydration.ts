import { hydrationLog, userProfile, workout } from "@mezo/db/schema";
import { TRPCError } from "@trpc/server";
import { and, asc, between, eq, gte, isNotNull, sql } from "drizzle-orm";
import { z } from "zod";
import {
	type DayTotal,
	DRINK_SLUGS,
	dailyTargetMl,
	effectiveMl,
	MAX_GOAL_ML,
	MIN_GOAL_ML,
	streakDays,
	typicalSessionSec,
	weekdayOf,
} from "../hydration.ts";
import { createTRPCRouter, protectedProcedure } from "../trpc.ts";
import { isoDay } from "../workout-shape.ts";

/**
 * Drinks.
 *
 * Every procedure filters on `ctx.session.user.id`, for the same reason the
 * workout router does: ids are minted in the browser, so an id on its own is a
 * value a signed-in user could type.
 *
 * The day a drink belongs to is the browser's, not the server's. Nothing here
 * ever derives a day from a timestamp. See the comment on `hydration_log.day`.
 */

/** A local calendar day, as the browser computed it. */
const DAY = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");

const ID = z.string().min(1).max(64);

/** A glass, a bottle, a jug. Nothing anybody drinks in one go is larger. */
const AMOUNT_ML = z.number().int().min(1).max(3000);

/** How far back the chart reads, and the widest window it will ask for. */
const DEFAULT_DAYS = 30;
const MAX_DAYS = 90;

/**
 * Entries per day. High enough that a sipper never meets it, low enough that
 * the table cannot be used as free storage one 1ml tap at a time.
 */
const ENTRIES_PER_DAY = 60;

const DAY_MS = 24 * 60 * 60 * 1000;

/** `2026-08-26` minus n days, staying on calendar days rather than instants. */
function shiftDay(day: string, back: number): string {
	const [year, month, date] = day.split("-").map(Number);
	const at = new Date(year ?? 1970, (month ?? 1) - 1, date ?? 1);
	at.setDate(at.getDate() - back);
	return isoDay(at);
}

/** Every day in the window, oldest first, so the chart has no gaps to invent. */
const daysBack = (endDay: string, days: number) =>
	Array.from({ length: days }, (_, index) =>
		shiftDay(endDay, days - 1 - index),
	);

export const hydrationRouter = createTRPCRouter({
	/**
	 * Everything the Hydration screen renders, in one round trip: today's
	 * drinks, today's target, and the days behind it.
	 *
	 * The client passes its own `day` because only it knows what day it is
	 * where the user is standing.
	 */
	overview: protectedProcedure
		.input(
			z.object({
				day: DAY,
				days: z.number().int().min(1).max(MAX_DAYS).default(DEFAULT_DAYS),
			}),
		)
		.query(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const window = daysBack(input.day, input.days);
			const from = window[0] as string;

			const [profile, entries, totals, sessions] = await Promise.all([
				ctx.db.query.userProfile.findFirst({
					where: eq(userProfile.userId, userId),
					columns: {
						weightKg: true,
						gender: true,
						hydrationGoalMl: true,
						trainingDays: true,
					},
				}),
				// Today in full, because the list is on screen and is deletable.
				ctx.db
					.select()
					.from(hydrationLog)
					.where(
						and(
							eq(hydrationLog.userId, userId),
							eq(hydrationLog.day, input.day),
						),
					)
					.orderBy(asc(hydrationLog.loggedAt)),
				// The rest as sums, because the chart wants one bar per day and
				// pulling a month of individual glasses to add them up in JavaScript
				// is a page of work Postgres already does.
				ctx.db
					.select({
						day: hydrationLog.day,
						amountMl: sql<number>`sum(${hydrationLog.amountMl})`.mapWith(
							Number,
						),
						// The index is per-drink, so the effective total has to be
						// weighted in the sum rather than applied to it afterwards.
						drink: hydrationLog.drink,
					})
					.from(hydrationLog)
					.where(
						and(
							eq(hydrationLog.userId, userId),
							between(hydrationLog.day, from, input.day),
						),
					)
					.groupBy(hydrationLog.day, hydrationLog.drink),
				// Training in the same window, for the sweat allowance. Only
				// finished sessions: a live one has no duration yet.
				ctx.db
					.select({
						startedAt: workout.startedAt,
						durationSec: workout.durationSec,
					})
					.from(workout)
					.where(
						and(
							eq(workout.userId, userId),
							isNotNull(workout.finishedAt),
							gte(
								workout.startedAt,
								new Date(new Date(`${from}T00:00:00`).getTime() - DAY_MS),
							),
						),
					),
			]);

			const drunkByDay = new Map<string, number>();
			for (const row of totals) {
				drunkByDay.set(
					row.day,
					(drunkByDay.get(row.day) ?? 0) + effectiveMl(row.amountMl, row.drink),
				);
			}

			const trainedByDay = new Map<string, number>();
			for (const session of sessions) {
				const day = isoDay(session.startedAt);
				trainedByDay.set(
					day,
					(trainedByDay.get(day) ?? 0) + session.durationSec,
				);
			}

			// What this person's sessions actually run to, so a day they have not
			// trained yet is estimated from their own training rather than from a
			// constant. Read from the sessions already in hand; `typicalSessionSec`
			// falls back to an hour when there are none.
			const typicalTrainingSec = typicalSessionSec(
				sessions.map((session) => session.durationSec),
			);

			const scheduled = new Set(profile?.trainingDays ?? []);
			const targetFor = (date: string) =>
				dailyTargetMl({
					weightKg: profile?.weightKg,
					gender: profile?.gender,
					goalMl: profile?.hydrationGoalMl,
					trainingSec: trainedByDay.get(date) ?? 0,
					plannedTraining: scheduled.has(weekdayOf(date)),
					typicalTrainingSec,
				});

			const days: DayTotal[] = window.map((date) => ({
				date,
				ml: Math.round(drunkByDay.get(date) ?? 0),
				targetMl: targetFor(date).targetMl,
			}));

			const today = targetFor(input.day);

			return {
				day: input.day,
				entries: entries.map((entry) => ({
					id: entry.id,
					amountMl: entry.amountMl,
					drink: entry.drink,
					loggedAt: entry.loggedAt,
					effectiveMl: effectiveMl(entry.amountMl, entry.drink),
				})),
				/** What today is worth against the target, after the index. */
				totalMl: days.at(-1)?.ml ?? 0,
				...today,
				/** Null unless the user set their own, so the screen can say which. */
				goalMl: profile?.hydrationGoalMl ?? null,
				/** The schedule behind `sweatFrom: "planned"`, for the screen to name. */
				trainingDays: profile?.trainingDays ?? [],
				days,
				streak: streakDays(days),
			};
		}),

	/**
	 * One drink. The id comes from the browser so the optimistic row on screen
	 * and the row in the table are the same row, and a retried tap is an upsert
	 * rather than a second glass.
	 */
	log: protectedProcedure
		.input(
			z.object({
				id: ID,
				day: DAY,
				amountMl: AMOUNT_ML,
				drink: z.enum(DRINK_SLUGS),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;

			const [{ count } = { count: 0 }] = await ctx.db
				.select({ count: sql<number>`count(*)`.mapWith(Number) })
				.from(hydrationLog)
				.where(
					and(eq(hydrationLog.userId, userId), eq(hydrationLog.day, input.day)),
				);

			if (count >= ENTRIES_PER_DAY) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: `That is ${ENTRIES_PER_DAY} drinks logged today. Edit one rather than adding another.`,
				});
			}

			await ctx.db
				.insert(hydrationLog)
				.values({
					id: input.id,
					userId,
					day: input.day,
					amountMl: input.amountMl,
					drink: input.drink,
				})
				// Same id, same drink: a double-fired tap, not two glasses.
				.onConflictDoNothing({ target: hydrationLog.id });
		}),

	/** Undo. The whole reason drinks are rows rather than a running total. */
	remove: protectedProcedure
		.input(z.object({ id: ID }))
		.mutation(async ({ ctx, input }) => {
			await ctx.db
				.delete(hydrationLog)
				.where(
					and(
						eq(hydrationLog.id, input.id),
						eq(hydrationLog.userId, ctx.session.user.id),
					),
				);
		}),

	/**
	 * Override the computed target, or clear the override with `null`.
	 *
	 * Its own procedure rather than a field on the settings form: this is set
	 * from the screen that shows what it does, and the questionnaire has no
	 * place to put a number whose sensible default is arithmetic.
	 */
	setGoal: protectedProcedure
		.input(
			z.object({
				ml: z.number().int().min(MIN_GOAL_ML).max(MAX_GOAL_ML).nullable(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			await ctx.db
				.insert(userProfile)
				.values({ userId, hydrationGoalMl: input.ml })
				.onConflictDoUpdate({
					target: userProfile.userId,
					set: { hydrationGoalMl: input.ml, updatedAt: new Date() },
				});
		}),
});
