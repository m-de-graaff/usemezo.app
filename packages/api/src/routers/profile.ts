import { user, userProfile } from "@mezo/db/schema";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { profileInput, usernameSchema } from "../profile-fields";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "../trpc";

/** Postgres unique violation. */
const UNIQUE_VIOLATION = "23505";

/**
 * Drizzle wraps driver errors, so the Postgres code sits somewhere down the
 * `cause` chain rather than on the error it throws. The depth bound is there so
 * a self-referential chain cannot spin.
 */
function isUniqueViolation(error: unknown, depth = 0): boolean {
	if (depth > 5 || typeof error !== "object" || error === null) return false;
	if ("code" in error && error.code === UNIQUE_VIOLATION) return true;
	return "cause" in error ? isUniqueViolation(error.cause, depth + 1) : false;
}

export const profileRouter = createTRPCRouter({
	/**
	 * The whole questionnaire plus the display name, which lives on `user`. A
	 * user who has never saved anything has no row yet, so every answer comes
	 * back null rather than the endpoint 404ing.
	 */
	get: protectedProcedure.query(async ({ ctx }) => {
		const profile = await ctx.db.query.userProfile.findFirst({
			where: eq(userProfile.userId, ctx.session.user.id),
		});

		return { ...profile, name: ctx.session.user.name };
	}),

	/**
	 * Partial by design: each settings screen sends only its own fields, so a
	 * key that is absent must survive untouched. Drizzle drops `undefined` from
	 * an update set, which is exactly that rule — `null` still clears an answer.
	 */
	update: protectedProcedure
		.input(profileInput)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const { name, ...answers } = input;

			if (name !== undefined) {
				await ctx.db
					.update(user)
					.set({ name, updatedAt: new Date() })
					.where(eq(user.id, userId));
			}

			if (Object.values(answers).some((value) => value !== undefined)) {
				try {
					await ctx.db
						.insert(userProfile)
						.values({ userId, ...answers })
						.onConflictDoUpdate({
							target: userProfile.userId,
							set: { ...answers, updatedAt: new Date() },
						});
				} catch (error) {
					// The only unique column here is the username, so the constraint
					// name does not need checking to know which one it was.
					if (isUniqueViolation(error)) {
						throw new TRPCError({
							code: "CONFLICT",
							message: "That username is taken. Try another.",
						});
					}
					throw error;
				}
			}
		}),

	/**
	 * Whether the signed-in user could take this handle. Advisory only: two
	 * people can pass this check at the same moment, so the unique index and the
	 * CONFLICT above stay the actual guarantee.
	 *
	 * Signed-in only, to keep it from being a bulk handle-enumeration endpoint.
	 */
	usernameAvailable: protectedProcedure
		.input(z.object({ username: usernameSchema }))
		.query(async ({ ctx, input }) => {
			const taken = await ctx.db.query.userProfile.findFirst({
				where: eq(userProfile.username, input.username),
				columns: { userId: true },
			});

			return { available: !taken || taken.userId === ctx.session.user.id };
		}),

	/** Marks the questionnaire as done so the app stops redirecting to it. */
	completeOnboarding: protectedProcedure.mutation(async ({ ctx }) => {
		const userId = ctx.session.user.id;
		const onboardedAt = new Date();

		await ctx.db
			.insert(userProfile)
			.values({ userId, onboardedAt })
			.onConflictDoUpdate({
				target: userProfile.userId,
				set: { onboardedAt, updatedAt: new Date() },
			});
	}),

	/**
	 * The public profile, by handle. Public on purpose, so the response is built
	 * from an explicit list of columns rather than by spreading the row — the
	 * health answers sit in the same table and must never leave it this way.
	 *
	 * Returns `visible: false` rather than 404 for a private profile: the handle
	 * is public by construction, so hiding its existence buys nothing, and the
	 * page needs to tell the two cases apart.
	 */
	byUsername: publicProcedure
		.input(z.object({ username: usernameSchema }))
		.query(async ({ ctx, input }) => {
			const row = await ctx.db.query.userProfile.findFirst({
				where: eq(userProfile.username, input.username),
				columns: {
					userId: true,
					username: true,
					isPublic: true,
					goals: true,
					preferredActivities: true,
					fitnessExperience: true,
				},
				with: {
					user: { columns: { name: true, image: true, createdAt: true } },
				},
			});

			if (!row) return null;

			const isOwner = ctx.session?.user.id === row.userId;
			if (!row.isPublic && !isOwner) {
				return { username: row.username, visible: false as const, isOwner };
			}

			return {
				username: row.username,
				visible: true as const,
				isOwner,
				name: row.user.name,
				image: row.user.image,
				memberSince: row.user.createdAt,
				goals: row.goals,
				preferredActivities: row.preferredActivities,
				fitnessExperience: row.fitnessExperience,
			};
		}),
});
