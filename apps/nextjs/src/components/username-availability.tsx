"use client";

import { usernameSchema } from "@mezo/api/profile-fields";
import { useState } from "react";
import { api } from "~/trpc/react";

/**
 * Checks a handle once the field is finished rather than on every keystroke.
 * Advisory: the unique index decides, and a save still reports a conflict if
 * someone claimed the handle in between.
 *
 * Shared by the settings form and onboarding, which ask the same question with
 * very different chrome around it.
 */
export function useUsernameAvailability(typed: unknown) {
	const value = typeof typed === "string" ? typed : "";
	// The handle we last asked about. Set on blur; cleared whenever it changes.
	const [checked, setChecked] = useState<string | null>(null);
	const parsed = usernameSchema.safeParse(value);

	const query = api.profile.usernameAvailable.useQuery(
		{ username: parsed.success ? parsed.data : "" },
		// Keeps the answer per handle, so going back to one already tried is free.
		{ enabled: parsed.success && checked === value },
	);

	const settled = checked === value && !query.isFetching;

	return {
		value,
		parsed,
		taken: settled && query.data?.available === false,
		free: settled && query.data?.available === true,
		loading: checked === value && query.isFetching,
		/** Call from the field's `onBlur`. */
		check: () => setChecked(value),
		/** Call whenever the field changes. */
		reset: () => setChecked(null),
	};
}

export type UsernameAvailability = ReturnType<typeof useUsernameAvailability>;

export function UsernameStatus({
	availability,
	className,
	id,
}: {
	availability: UsernameAvailability;
	className?: string;
	/** So the field it belongs to can point `aria-describedby` at it. */
	id?: string;
}) {
	const { value, parsed, taken, free, loading } = availability;

	if (value === "") return null;

	const message = !parsed.success
		? parsed.error.issues[0]?.message
		: loading
			? "Checking availability..."
			: taken
				? `${parsed.data} is taken, try another.`
				: free
					? `${parsed.data} is available.`
					: null;

	if (!message) return null;

	return (
		<p
			aria-live="polite"
			className={`${parsed.success && !taken ? "text-muted-foreground" : "text-destructive"} ${className ?? ""}`}
			id={id}
		>
			{message}
		</p>
	);
}
