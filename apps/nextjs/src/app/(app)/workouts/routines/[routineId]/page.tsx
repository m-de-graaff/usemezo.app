import { getSession } from "@mezo/auth/server";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { RoutineBuilder } from "~/components/workouts/routine-builder";
import { api } from "~/trpc/server";

export const metadata: Metadata = { title: "Routine | Mezo" };

export default async function RoutinePage({
	params,
}: {
	params: Promise<{ routineId: string }>;
}) {
	// The proxy only sees a cookie; this is the real check.
	const session = await getSession();
	if (!session) redirect("/sign-in?callbackURL=/workouts");

	const { routineId } = await params;
	// Null for a routine that does not exist yet, which is the normal case: New
	// routine sends people here with an id nothing has written to. It is also
	// what somebody else's id returns, and the two look the same on purpose.
	const routine = await api.workout.routine({ id: routineId });

	return <RoutineBuilder id={routineId} routine={routine} />;
}
