import { relations, sql } from "drizzle-orm";
import {
	boolean,
	date,
	index,
	integer,
	jsonb,
	pgTable,
	pgTableCreator,
	primaryKey,
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
		/**
		 * Whether a session started from a routine gets its weights raised from
		 * the user's own history. Off by default, and deliberately: rewriting
		 * somebody's programme is something they have to ask for.
		 */
		progressiveOverload: boolean("progressive_overload")
			.default(false)
			.notNull(),
		fitnessExperience: text("fitness_experience"),
		preferredActivities: text("preferred_activities").array(),
		sleepHours: text("sleep_hours"),
		/**
		 * The days of the week this person usually trains, as `WEEKDAYS` slugs.
		 * A plan rather than a record: what actually happened is in `workout`,
		 * and this is what lets a target be right in the morning instead of only
		 * once a session has been finished.
		 */
		trainingDays: text("training_days").array(),

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
		/**
		 * The water outside the cells. Stored on its own because the split is
		 * what a reader wants and total body water is the part that derives from
		 * it: intracellular is whatever is left, and the ratio against the total
		 * is the number a clinician actually looks at.
		 */
		extracellularWaterKg: real("extracellular_water_kg"),
		/**
		 * Degrees, from a bioimpedance device. The only figure on a scan that is
		 * not arithmetic on the others: it comes from the raw reactance and
		 * resistance, and it tracks cell membrane integrity rather than a mass.
		 * Fat free mass and soft lean mass are deliberately absent for the
		 * opposite reason — see `bodyComposition` in `@mezo/api/plan`.
		 */
		phaseAngleDeg: real("phase_angle_deg"),
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
		/**
		 * A hydration target the user set themselves, in millilitres. Null means
		 * the computed one stands — see `dailyTargetMl` in `@mezo/api/hydration`,
		 * which is where the arithmetic lives rather than here.
		 */
		hydrationGoalMl: integer("hydration_goal_ml"),

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
		/**
		 * The reply still being written, if there is one.
		 *
		 * Set when a turn starts and cleared when it ends, so a browser that
		 * comes back to this conversation can ask to be reconnected to a run that
		 * is still going rather than finding the question it asked and nothing
		 * after it. The id addresses a buffer on the server, not the reply
		 * itself: a run that outlives the process leaves this pointing at
		 * nothing, which reads as "no longer resumable" and not as an error.
		 */
		activeStreamId: text("active_stream_id"),
		createdAt: timestamp("created_at")
			.$defaultFn(() => new Date())
			.notNull(),
		updatedAt: timestamp("updated_at")
			.$defaultFn(() => new Date())
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(t) => [
		// The list screen only ever asks for one user's threads, newest first.
		index("milo_thread_user_updated_idx").on(t.userId, t.updatedAt),
		// The resume endpoint arrives with a stream id and nothing else, and this
		// is how it finds out whose it is.
		index("milo_thread_active_stream_idx").on(t.activeStreamId),
	],
);

/**
 * A named group of routines, and nothing else.
 *
 * The list screen is the only reader: a folder has no exercises, no schedule
 * and no meaning beyond the heading it puts above a handful of routines. A
 * routine with no folder is not an error state, it is the common one, so the
 * link is nullable and deleting a folder loosens its routines rather than
 * taking them with it.
 */
export const routineFolder = pgTable(
	"routine_folder",
	{
		// Minted in the browser, like a routine's, so the list can render the new
		// folder before the write comes back.
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		/** Where the folder sits among this user's folders. */
		position: integer("position").notNull().default(0),
		createdAt: timestamp("created_at")
			.$defaultFn(() => new Date())
			.notNull(),
		updatedAt: timestamp("updated_at")
			.$defaultFn(() => new Date())
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(t) => [index("routine_folder_user_position_idx").on(t.userId, t.position)],
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
		/**
		 * The folder it is filed under, or null for the loose pile the list shows
		 * last. `set null` rather than `cascade`: deleting a heading must not
		 * delete the training underneath it.
		 */
		folderId: text("folder_id").references(() => routineFolder.id, {
			onDelete: "set null",
		}),
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

/**
 * What Milo remembers about somebody between conversations.
 *
 * The questionnaire in `user_profile` holds the answers Mezo knows to ask for.
 * This holds the ones it does not: "wants a V-taper", "trains at a gym with no
 * hack squat", "shoulder gives out on overhead pressing". They arrive in the
 * middle of a sentence about something else, they are the difference between a
 * coach and a form, and there is no column that could have anticipated them.
 *
 * A row rather than a `jsonb` array on the profile, because these are written
 * and deleted one at a time from two different places — the model as it works,
 * and the user reviewing the list — and a whole-document rewrite between those
 * two is a lost note.
 */
export const miloNote = pgTable(
	"milo_note",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		/**
		 * What kind of thing this is, which is what decides the order it reaches
		 * the model in: a goal shapes everything and a stray fact does not.
		 */
		kind: text("kind").notNull().default("fact"),
		/** One fact, in the user's own terms. Short enough to read in a list. */
		text: text("text").notNull(),
		createdAt: timestamp("created_at")
			.$defaultFn(() => new Date())
			.notNull(),
		updatedAt: timestamp("updated_at")
			.$defaultFn(() => new Date())
			.$onUpdate(() => new Date())
			.notNull(),
	},
	// Every read is one user's notes, newest first.
	(t) => [index("milo_note_user_updated_idx").on(t.userId, t.updatedAt)],
);

/**
 * An exercise the dataset never had.
 *
 * The catalogue in `@mezo/api/exercises` is a fixed list of about 1300
 * movements, and it is missing things people actually train: a Bayesian curl,
 * whatever a coach invented last year, the one machine at somebody's gym with a
 * name only that gym uses. Milo can add one when a user asks for it, and from
 * then on it is picked, programmed and logged like any other exercise.
 *
 * The columns mirror `Exercise` because that is what these rows are turned back
 * into. `body_part` and `equipment` are constrained in code rather than in SQL:
 * their allowed values are derived from the dataset itself, so they change when
 * the dataset does and a check constraint would be a migration every time.
 * There is no media column — nobody drew a picture of it.
 *
 * A row per exercise rather than an array on the profile, for the same reason
 * `milo_note` is a table: these are written one at a time by the model and
 * deleted one at a time by the user, and a whole-document rewrite between those
 * two loses whichever wrote second.
 */
export const customExercise = pgTable(
	"custom_exercise",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		/** Stored as typed. Uniqueness per user is checked case-insensitively. */
		name: text("name").notNull(),
		bodyPart: text("body_part").notNull(),
		equipment: text("equipment").notNull(),
		/** The primary muscle, in the catalogue's own vocabulary. */
		target: text("target").notNull(),
		secondary: text("secondary").array().notNull().default(sql`'{}'`),
		createdAt: timestamp("created_at")
			.$defaultFn(() => new Date())
			.notNull(),
		updatedAt: timestamp("updated_at")
			.$defaultFn(() => new Date())
			.$onUpdate(() => new Date())
			.notNull(),
	},
	// Every read is the same one: this user's exercises, to merge into the
	// catalogue before anything is searched or rendered.
	(t) => [index("custom_exercise_user_idx").on(t.userId, t.name)],
);

/**
 * An exercise this user never wants offered again.
 *
 * A blacklist rather than a preference score. "Never show me upright rows"
 * needs to be honoured exactly, by the picker and by Milo alike, and a ranking
 * that merely deprioritises something is how a movement somebody's shoulder
 * cannot do reappears in a routine six weeks later.
 *
 * `exercise_id` has no foreign key: it holds ids from both layers, the fixed
 * catalogue in code and `custom_exercise`, and there is no one table to point
 * at. The cost is that a deleted custom exercise leaves its blacklist row
 * behind, which is a row matching nothing rather than a bug.
 *
 * Hiding only ever filters search. Sessions somebody already did still render,
 * because a blacklist is a statement about the future.
 */
export const hiddenExercise = pgTable(
	"hidden_exercise",
	{
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		exerciseId: text("exercise_id").notNull(),
		/** Why they hid it, when they said. Shown back on the unhide screen. */
		reason: text("reason"),
		createdAt: timestamp("created_at")
			.$defaultFn(() => new Date())
			.notNull(),
	},
	// The pair is the row: hiding the same exercise twice is the same fact.
	(t) => [primaryKey({ columns: [t.userId, t.exerciseId] })],
);

/**
 * One drink.
 *
 * A row per drink rather than a running total per day, because the thing people
 * actually do with a hydration tracker is undo the tap they did not mean: a
 * counter can only be decremented by a guess at what the last entry was.
 *
 * `day` is the drinker's local day, sent by the browser, and is deliberately
 * not derived from `loggedAt` on the server. A glass at half eleven at night
 * belongs to the day the person drinking it thinks it does, and the server has
 * no idea which day that is.
 *
 * `amountMl` is what was in the glass, before the hydration index in
 * `@mezo/api/hydration` is applied. The index is a rule that can be revised;
 * what somebody drank is not.
 */
export const hydrationLog = pgTable(
	"hydration_log",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		day: date("day").notNull(),
		amountMl: integer("amount_ml").notNull(),
		/** A slug from `DRINKS`; unknown ones count at face value. */
		drink: text("drink").notNull().default("water"),
		loggedAt: timestamp("logged_at")
			.$defaultFn(() => new Date())
			.notNull(),
	},
	// Every read this table has is one user over a range of days.
	(t) => [index("hydration_log_user_day_idx").on(t.userId, t.day)],
);

export const userRelations = relations(user, ({ many, one }) => ({
	account: many(account),
	session: many(session),
	miloThreads: many(miloThread),
	miloNotes: many(miloNote),
	customExercises: many(customExercise),
	hiddenExercises: many(hiddenExercise),
	routineFolders: many(routineFolder),
	routines: many(routine),
	workouts: many(workout),
	hydrationLogs: many(hydrationLog),
	profile: one(userProfile, {
		fields: [user.id],
		references: [userProfile.userId],
	}),
}));

export const routineFolderRelations = relations(
	routineFolder,
	({ one, many }) => ({
		user: one(user, { fields: [routineFolder.userId], references: [user.id] }),
		routines: many(routine),
	}),
);

export const routineRelations = relations(routine, ({ one, many }) => ({
	user: one(user, { fields: [routine.userId], references: [user.id] }),
	folder: one(routineFolder, {
		fields: [routine.folderId],
		references: [routineFolder.id],
	}),
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

export const miloNoteRelations = relations(miloNote, ({ one }) => ({
	user: one(user, { fields: [miloNote.userId], references: [user.id] }),
}));

export const accountRelations = relations(account, ({ one }) => ({
	user: one(user, { fields: [account.userId], references: [user.id] }),
}));

export const sessionRelations = relations(session, ({ one }) => ({
	user: one(user, { fields: [session.userId], references: [user.id] }),
}));

export const customExerciseRelations = relations(customExercise, ({ one }) => ({
	user: one(user, { fields: [customExercise.userId], references: [user.id] }),
}));

export const hiddenExerciseRelations = relations(hiddenExercise, ({ one }) => ({
	user: one(user, { fields: [hiddenExercise.userId], references: [user.id] }),
}));

export const hydrationLogRelations = relations(hydrationLog, ({ one }) => ({
	user: one(user, { fields: [hydrationLog.userId], references: [user.id] }),
}));
