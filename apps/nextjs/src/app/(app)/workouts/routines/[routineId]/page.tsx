import { getSession } from "@mezo/auth/server";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { RoutineScreen } from "~/components/workouts/routine-screen";
import { api } from "~/trpc/server";

export const metadata: Metadata = { title: "Routine" };

export default async function RoutinePage({
	params,
	searchParams,
}: {
	params: Promise<{ routineId: string }>;
	searchParams: Promise<{ edit?: string }>;
}) {
	// The proxy only sees a cookie; this is the real check.
	const session = await getSession();
	if (!session) redirect("/sign-in?callbackURL=/workouts");

	const [{ routineId }, { edit }] = await Promise.all([params, searchParams]);

	// Null for a routine that does not exist yet, which is the normal case: New
	// routine sends people here with an id nothing has written to. It is also
	// what somebody else's id returns, and the two look the same on purpose.
	const [routine, active] = await Promise.all([
		api.workout.routine({ id: routineId }),
		api.workout.active(),
	]);

	return (
		<RoutineScreen
			// `?edit=1` is the list's Edit, which skips the read-only stop.
			editing={edit !== undefined}
			hasLiveWorkout={active !== null}
			id={routineId}
			routine={routine}
		/>
	);
}
