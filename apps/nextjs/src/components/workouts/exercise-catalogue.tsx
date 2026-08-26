"use client";

import {
	type Exercise,
	registerCustomExercises,
	type UserCatalogue,
} from "@mezo/api/exercises";
import { createContext, useContext, useMemo } from "react";
import { api } from "~/trpc/react";

/**
 * The exercise catalogue as *this* user sees it: the shipped list, plus the
 * exercises they added, minus the ones they blacklisted.
 *
 * Two ways out of here, and which one to use depends on whether the caller has
 * to react to a change.
 *
 * Most callers only want a name or a picture for an id they already hold, so
 * they call `exerciseById` and never touch this. That works because the list is
 * registered into `@mezo/api/exercises` on the way through, which is safe in a
 * browser precisely because it would not be on a server: there is one user per
 * tab.
 *
 * The picker wants the live value — hiding something has to remove it from the
 * list under your finger — so it reads the context.
 *
 * ponytail: registering does not re-render anything, so a name rendered
 * elsewhere on screen when an exercise is created lags until that component
 * re-renders for its own reasons. Every screen that shows one is a screen the
 * user is editing, so this has not been worth a subscription; make the module
 * state a store if it ever is.
 */

const EMPTY: UserCatalogue = { custom: [], hidden: new Set() };

const CatalogueContext = createContext<UserCatalogue>(EMPTY);

export const useCatalogue = () => useContext(CatalogueContext);

export function ExerciseCatalogue({
	children,
	initial,
}: {
	children: React.ReactNode;
	/** Read in the layout, so the first client render already has the list. */
	initial: { custom: readonly Exercise[]; hidden: string[] };
}) {
	const { data } = api.exercise.catalogue.useQuery(undefined, {
		initialData: initial,
	});

	return (
		<CatalogueContext.Provider
			// Registered from inside the memo rather than an effect: an effect runs
			// after the children have rendered, which is one paint of "Unknown
			// exercise" on every navigation. Writing the same map twice is harmless.
			value={useMemo(() => {
				registerCustomExercises(data.custom);
				return { custom: data.custom, hidden: new Set(data.hidden) };
			}, [data])}
		>
			{children}
		</CatalogueContext.Provider>
	);
}
