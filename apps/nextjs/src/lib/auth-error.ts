type AuthError = { message?: string; code?: string; status?: number };

/**
 * Better Auth returns a code plus a message. The message is fine for most
 * cases; these are the ones where it is too terse to act on.
 */
export function authErrorMessage(error: AuthError, fallback: string) {
	if (error.status === 429) {
		return "Too many attempts. Wait a minute and try again.";
	}
	switch (error.code) {
		case "EMAIL_NOT_VERIFIED":
			return "Verify your email first — we just sent you a fresh link.";
		case "INVALID_EMAIL_OR_PASSWORD":
			return "That email and password combination is not right.";
		case "USER_ALREADY_EXISTS":
			return "An account with that email already exists.";
		case "INVALID_TOKEN":
		case "TOKEN_EXPIRED":
			return "That link has expired. Request a new one.";
		default:
			return error.message ?? fallback;
	}
}
