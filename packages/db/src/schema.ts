import { relations, sql } from "drizzle-orm";
import {
	boolean,
	date,
	index,
	integer,
	jsonb,
	pgTable,
	pgTableCreator,
	real,
	text,
	timestamp,
	uniqueIndex,
} from "drizzle-orm/pg-core";

export const createTable = pgTableCreator((name) => `pg-drizzle_${name}`);

export const posts = createTable(
	"post",
	(d) => ({
		id: d.integer().primaryKey().generatedByDefaultAsIdentity(),
		name: d.varchar({ length: 256 }),
		createdById: d
			.varchar({ length: 255 })
			.notNull()
			.references(() => user.id),
		createdAt: d
			.timestamp({ withTimezone: true })
			.$defaultFn(() => new Date())
			.notNull(),
		updatedAt: d.timestamp({ withTimezone: true }).$onUpdate(() => new Date()),
	}),
	(t) => [
		index("created_by_idx").on(t.createdById),
		index("name_idx").on(t.name),
	],
);

export const user = pgTable("user", {
	id: text("id").primaryKey(),
	name: text("name").notNull(),
	email: text("email").notNull().unique(),
	emailVerified: boolean("email_verified")
		.$defaultFn(() => false)
		.notNull(),
	image: text("image"),
	createdAt: timestamp("created_at")
		.$defaultFn(() => /* @__PURE__ */ new Date())
		.notNull(),
	updatedAt: timestamp("updated_at")
		.$defaultFn(() => /* @__PURE__ */ new Date())
		.notNull(),
	// Set by the Stripe plugin the first time a customer is created.
	stripeCustomerId: text("stripe_customer_id"),
});

export const session = pgTable("session", {
	id: text("id").primaryKey(),
	expiresAt: timestamp("expires_at").notNull(),
	token: text("token").notNull().unique(),
	createdAt: timestamp("created_at").notNull(),
	updatedAt: timestamp("updated_at").notNull(),
	ipAddress: text("ip_address"),
	userAgent: text("user_agent"),
	userId: text("user_id")
		.notNull()
		.references(() => user.id, { onDelete: "cascade" }),
});

export const account = pgTable(
	"account",
	{
		id: text("id").primaryKey(),
		// Better Auth 1.7+ requires this; see migrations/0001_account_issuer.sql.
		issuer: text("issuer").notNull(),
		accountId: text("account_id").notNull(),
		providerId: text("provider_id").notNull(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		accessToken: text("access_token"),
		refreshToken: text("refresh_token"),
		idToken: text("id_token"),
		accessTokenExpiresAt: timestamp("access_token_expires_at"),
		refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
		scope: text("scope"),
		password: text("password"),
		createdAt: timestamp("created_at").notNull(),
		updatedAt: timestamp("updated_at").notNull(),
	},
	(t) => [
		uniqueIndex("account_issuer_account_id_unique").on(t.issuer, t.accountId),
	],
);

export const verification = pgTable("verification", {
	id: text("id").primaryKey(),
	identifier: text("identifier").notNull(),
	value: text("value").notNull(),
	expiresAt: timestamp("expires_at").notNull(),
	createdAt: timestamp("created_at").$defaultFn(
		() => /* @__PURE__ */ new Date(),
	),
	updatedAt: timestamp("updated_at").$defaultFn(
		() => /* @__PURE__ */ new Date(),
	),
});

// --- Better Auth plugin tables ---------------------------------------------
// Generated from `getAuthTables()` for the jwt, mcp (OAuth provider) and
// apiKey plugins. Property names must keep matching Better Auth's model and
// field names; only the SQL names are snake_cased to match the rest of the DB.

export const jwks = pgTable("jwks", {
	id: text("id").primaryKey(),
	publicKey: text("public_key").notNull(),
	privateKey: text("private_key").notNull(),
	createdAt: timestamp("created_at").notNull(),
	expiresAt: timestamp("expires_at"),
	alg: text("alg"),
	crv: text("crv"),
});

export const oauthClient = pgTable("oauth_client", {
	id: text("id").primaryKey(),
	clientId: text("client_id").notNull().unique(),
	clientSecret: text("client_secret"),
	clientDiscoveryId: text("client_discovery_id"),
	disabled: boolean("disabled"),
	skipConsent: boolean("skip_consent"),
	enableEndSession: boolean("enable_end_session"),
	subjectType: text("subject_type"),
	scopes: text("scopes").array(),
	clientCredentialsScopes: text("client_credentials_scopes").array(),
	userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),
	createdAt: timestamp("created_at"),
	updatedAt: timestamp("updated_at"),
	name: text("name"),
	uri: text("uri"),
	icon: text("icon"),
	contacts: text("contacts").array(),
	tos: text("tos"),
	policy: text("policy"),
	softwareId: text("software_id"),
	softwareVersion: text("software_version"),
	softwareStatement: text("software_statement"),
	redirectUris: text("redirect_uris").array().notNull(),
	postLogoutRedirectUris: text("post_logout_redirect_uris").array(),
	backchannelLogoutUri: text("backchannel_logout_uri"),
	backchannelLogoutSessionRequired: boolean(
		"backchannel_logout_session_required",
	),
	tokenEndpointAuthMethod: text("token_endpoint_auth_method"),
	applicationType: text("application_type"),
	jwks: text("jwks"),
	jwksUri: text("jwks_uri"),
	grantTypes: text("grant_types").array(),
	responseTypes: text("response_types").array(),
	requirePKCE: boolean("require_pkce"),
	dpopBoundAccessTokens: boolean("dpop_bound_access_tokens"),
	referenceId: text("reference_id"),
	metadata: jsonb("metadata"),
});

export const oauthResource = pgTable("oauth_resource", {
	id: text("id").primaryKey(),
	identifier: text("identifier").notNull().unique(),
	name: text("name").notNull(),
	accessTokenTtl: integer("access_token_ttl"),
	refreshTokenTtl: integer("refresh_token_ttl"),
	signingAlgorithm: text("signing_algorithm"),
	signingKeyId: text("signing_key_id"),
	allowedScopes: text("allowed_scopes").array(),
	customClaims: jsonb("custom_claims"),
	dpopBoundAccessTokensRequired: boolean("dpop_bound_access_tokens_required"),
	disabled: boolean("disabled"),
	createdAt: timestamp("created_at"),
	updatedAt: timestamp("updated_at"),
	policyVersion: integer("policy_version"),
	metadata: jsonb("metadata"),
});

export const oauthClientResource = pgTable("oauth_client_resource", {
	id: text("id").primaryKey(),
	clientId: text("client_id")
		.notNull()
		.references(() => oauthClient.clientId, { onDelete: "cascade" }),
	resourceId: text("resource_id")
		.notNull()
		.references(() => oauthResource.identifier, { onDelete: "cascade" }),
	metadata: jsonb("metadata"),
	createdAt: timestamp("created_at"),
});

export const oauthRefreshToken = pgTable("oauth_refresh_token", {
	id: text("id").primaryKey(),
	token: text("token").notNull().unique(),
	clientId: text("client_id")
		.notNull()
		.references(() => oauthClient.clientId, { onDelete: "cascade" }),
	sessionId: text("session_id").references(() => session.id, {
		onDelete: "cascade",
	}),
	userId: text("user_id")
		.notNull()
		.references(() => user.id, { onDelete: "cascade" }),
	referenceId: text("reference_id"),
	authorizationCodeId: text("authorization_code_id"),
	resources: text("resources").array(),
	requestedUserInfoClaims: text("requested_user_info_claims").array(),
	expiresAt: timestamp("expires_at").notNull(),
	createdAt: timestamp("created_at").notNull(),
	revoked: timestamp("revoked"),
	rotatedAt: timestamp("rotated_at"),
	rotationReplayResponse: text("rotation_replay_response"),
	rotationReplayExpiresAt: timestamp("rotation_replay_expires_at"),
	authTime: timestamp("auth_time"),
	confirmation: jsonb("confirmation"),
	scopes: text("scopes").array().notNull(),
});

export const oauthAccessToken = pgTable("oauth_access_token", {
	id: text("id").primaryKey(),
	token: text("token").notNull().unique(),
	clientId: text("client_id")
		.notNull()
		.references(() => oauthClient.clientId, { onDelete: "cascade" }),
	sessionId: text("session_id").references(() => session.id, {
		onDelete: "cascade",
	}),
	userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),
	referenceId: text("reference_id"),
	authorizationCodeId: text("authorization_code_id"),
	resources: text("resources").array(),
	requestedUserInfoClaims: text("requested_user_info_claims").array(),
	refreshId: text("refresh_id").references(() => oauthRefreshToken.id, {
		onDelete: "cascade",
	}),
	expiresAt: timestamp("expires_at").notNull(),
	createdAt: timestamp("created_at").notNull(),
	revoked: timestamp("revoked"),
	confirmation: jsonb("confirmation"),
	scopes: text("scopes").array().notNull(),
});

export const oauthConsent = pgTable("oauth_consent", {
	id: text("id").primaryKey(),
	clientId: text("client_id")
		.notNull()
		.references(() => oauthClient.clientId, { onDelete: "cascade" }),
	userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),
	referenceId: text("reference_id"),
	resources: text("resources").array(),
	requestedUserInfoClaims: text("requested_user_info_claims").array(),
	scopes: text("scopes").array().notNull(),
	createdAt: timestamp("created_at").notNull(),
	updatedAt: timestamp("updated_at").notNull(),
});

export const oauthClientAssertion = pgTable("oauth_client_assertion", {
	id: text("id").primaryKey(),
	expiresAt: timestamp("expires_at").notNull(),
});

export const apikey = pgTable("apikey", {
	id: text("id").primaryKey(),
	configId: text("config_id").notNull(),
	name: text("name"),
	start: text("start"),
	referenceId: text("reference_id").notNull(),
	prefix: text("prefix"),
	key: text("key").notNull(),
	refillInterval: integer("refill_interval"),
	refillAmount: integer("refill_amount"),
	lastRefillAt: timestamp("last_refill_at"),
	enabled: boolean("enabled"),
	rateLimitEnabled: boolean("rate_limit_enabled"),
	rateLimitTimeWindow: integer("rate_limit_time_window"),
	rateLimitMax: integer("rate_limit_max"),
	requestCount: integer("request_count"),
	remaining: integer("remaining"),
	lastRequest: timestamp("last_request"),
	expiresAt: timestamp("expires_at"),
	createdAt: timestamp("created_at").notNull(),
	updatedAt: timestamp("updated_at").notNull(),
	permissions: text("permissions"),
	metadata: text("metadata"),
});

/**
 * One row per user, holding everything the settings screens collect. Every
 * column is nullable on purpose — the questionnaire is filled in over time, and
 * a half-answered profile is the normal state, not an error. The allowed values
 * for the text columns live in `@mezo/api/profile-fields`, which is also what
 * validates a write; keeping them out of the database means adding an option is
 * a code change rather than a migration.
 */
export const userProfile = pgTable(
	"user_profile",
	{
		userId: text("user_id")
			.primaryKey()
			.references(() => user.id, { onDelete: "cascade" }),

		// Account. The handle is stored lower-cased so the unique index is the
		// case-insensitive check — see `profileInput` in `@mezo/api/profile-fields`.
		username: text("username"),
		/**
		 * Display preference only. Heights are always stored in centimetres and
		 * weights in kilograms; this decides what the user is shown and types in.
		 */
		units: text("units"),
		isPublic: boolean("is_public").default(false).notNull(),
		/** Set when the onboarding flow finishes; null means it still owes a run. */
		onboardedAt: timestamp("onboarded_at"),

		// Goals and activity
		goals: text("goals").array(),
		fitnessExperience: text("fitness_experience"),
		preferredActivities: text("preferred_activities").array(),
		sleepHours: text("sleep_hours"),

		// Profile
		birthDate: date("birth_date"),
		gender: text("gender"),
		bloodType: text("blood_type"),

		// Body
		bodyType: text("body_type"),
		heightCm: integer("height_cm"),
		weightKg: real("weight_kg"),
		/** Where the user wants their weight to go; drives the calorie target. */
		goalDirection: text("goal_direction"),
		targetWeightKg: real("target_weight_kg"),
		/** Daily movement outside training. The TDEE multiplier keys off this. */
		activityLevel: text("activity_level"),

		/**
		 * Body composition, as a smart scale or a DEXA reports it. All optional
		 * and all stored metric, the same rule as `weightKg`: the unit preference
		 * only decides what is shown.
		 */
		bodyFatPercent: real("body_fat_percent"),
		bodyFatMassKg: real("body_fat_mass_kg"),
		skeletalMuscleMassKg: real("skeletal_muscle_mass_kg"),
		totalBodyWaterKg: real("total_body_water_kg"),
		boneMassKg: real("bone_mass_kg"),
		proteinMassKg: real("protein_mass_kg"),
		/** The scale's own 1-59 index, not a mass. */
		visceralFatLevel: integer("visceral_fat_level"),
		/** What the device measured, which beats anything Mezo would estimate. */
		basalMetabolicRateKcal: integer("basal_metabolic_rate_kcal"),
		waistCm: real("waist_cm"),

		// Nutrition
		eatingHabits: text("eating_habits"),
		dailyCalories: integer("daily_calories"),

		// Health
		// Picked from a list rather than typed, so these are arrays of slugs the
		// same way `goals` is.
		medications: text("medications").array(),
		supplements: text("supplements").array(),
		physicalLimitations: text("physical_limitations").array(),
		checkupFrequency: text("checkup_frequency"),

		updatedAt: timestamp("updated_at")
			.$defaultFn(() => new Date())
			.$onUpdate(() => new Date())
			.notNull(),
	},
	// Named to match migrations/0004, which builds it CONCURRENTLY.
	(t) => [uniqueIndex("user_profile_username_key").on(t.username)],
);

/**
 * One Milo conversation, messages and all.
 *
 * The whole thread lives in a single `jsonb` column rather than a row per
 * message: the AI SDK hands the route a complete `UIMessage[]` at the end of
 * every turn, and a message table would mean taking that apart and putting it
 * back together for no reader that wants the pieces. Nothing queries inside a
 * conversation — the list screen wants titles, and the chat wants the lot.
 *
 * ponytail: the whole thread is rewritten once per turn. Fine for a chat
 * someone reads; split into a message table if threads ever run to thousands.
 */
export const miloThread = pgTable(
	"milo_thread",
	{
		// Generated by the browser, so the first message of a new chat already
		// knows which thread it belongs to and nothing has to round-trip first.
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		/** Taken from the opening message; null until there is one. */
		title: text("title"),
		/** `UIMessage[]` as the AI SDK defines it. */
		messages: jsonb("messages").notNull().default([]),
		createdAt: timestamp("created_at")
			.$defaultFn(() => new Date())
			.notNull(),
		updatedAt: timestamp("updated_at")
			.$defaultFn(() => new Date())
			.$onUpdate(() => new Date())
			.notNull(),
	},
	// The list screen only ever asks for one user's threads, newest first.
	(t) => [index("milo_thread_user_updated_idx").on(t.userId, t.updatedAt)],
);

/**
 * A saved routine: a name and an ordered list of exercises with their planned
 * sets.
 *
 * The exercise list is one `jsonb` document for the same reason `milo_thread`
 * keeps its messages that way. Nothing queries inside a routine: every screen
 * that wants one wants all of it, and a row per set would mean taking the
 * document apart and putting it back together for no reader at all. The shape
 * is `routineExercises` in `@mezo/api/workout-shape`, which is also what
 * validates a write.
 */
export const routine = pgTable(
	"routine",
	{
		// Minted in the browser, so a new routine has a URL before it has a row.
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		note: text("note"),
		/** Where it sits in the user's own list. Ties break on `createdAt`. */
		position: integer("position").notNull().default(0),
		exercises: jsonb("exercises").notNull().default([]),
		createdAt: timestamp("created_at")
			.$defaultFn(() => new Date())
			.notNull(),
		updatedAt: timestamp("updated_at")
			.$defaultFn(() => new Date())
			.$onUpdate(() => new Date())
			.notNull(),
	},
	// The only query the list screen makes: this user's routines, in their order.
	(t) => [index("routine_user_position_idx").on(t.userId, t.position)],
);

/**
 * One training session, live or finished.
 *
 * There is no separate "active workout" concept: a live session is this row
 * with `finishedAt` still null, which makes resuming after a closed tab or on
 * another device an ordinary read rather than a recovery path. The partial
 * unique index is what makes that safe, by making a second live session
 * impossible rather than merely unexpected.
 *
 * `volumeKg`, `setCount` and `durationSec` are written once, when the session
 * finishes. They are derivable from `exercises`, and derived they are, by
 * `@mezo/api/workout-shape` at the moment of finishing. Storing the answers is
 * what lets the history list and the dashboard read a hundred sessions without
 * unpacking a hundred documents.
 */
export const workout = pgTable(
	"workout",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		/**
		 * Where the session came from, when it came from anywhere. `set null`
		 * rather than `cascade`: deleting a routine must not delete the training
		 * somebody did from it.
		 */
		routineId: text("routine_id").references(() => routine.id, {
			onDelete: "set null",
		}),
		name: text("name").notNull(),
		note: text("note"),
		exercises: jsonb("exercises").notNull().default([]),
		startedAt: timestamp("started_at")
			.$defaultFn(() => new Date())
			.notNull(),
		/** Null while the session is live. Set once, on finish. */
		finishedAt: timestamp("finished_at"),
		volumeKg: real("volume_kg").notNull().default(0),
		setCount: integer("set_count").notNull().default(0),
		durationSec: integer("duration_sec").notNull().default(0),
	},
	(t) => [
		// History, newest first, and every date-ranged read the dashboard makes.
		index("workout_user_started_idx").on(t.userId, t.startedAt),
		// One live session per user, as a fact about the data rather than a rule
		// the router has to keep remembering to apply.
		uniqueIndex("workout_one_live_per_user")
			.on(t.userId)
			.where(sql`finished_at IS NULL`),
	],
);

export const userRelations = relations(user, ({ many, one }) => ({
	account: many(account),
	session: many(session),
	miloThreads: many(miloThread),
	routines: many(routine),
	workouts: many(workout),
	profile: one(userProfile, {
		fields: [user.id],
		references: [userProfile.userId],
	}),
}));

export const routineRelations = relations(routine, ({ one, many }) => ({
	user: one(user, { fields: [routine.userId], references: [user.id] }),
	workouts: many(workout),
}));

export const workoutRelations = relations(workout, ({ one }) => ({
	user: one(user, { fields: [workout.userId], references: [user.id] }),
	routine: one(routine, {
		fields: [workout.routineId],
		references: [routine.id],
	}),
}));

export const userProfileRelations = relations(userProfile, ({ one }) => ({
	user: one(user, { fields: [userProfile.userId], references: [user.id] }),
}));

export const miloThreadRelations = relations(miloThread, ({ one }) => ({
	user: one(user, { fields: [miloThread.userId], references: [user.id] }),
}));

export const accountRelations = relations(account, ({ one }) => ({
	user: one(user, { fields: [account.userId], references: [user.id] }),
}));

export const sessionRelations = relations(session, ({ one }) => ({
	user: one(user, { fields: [session.userId], references: [user.id] }),
}));
