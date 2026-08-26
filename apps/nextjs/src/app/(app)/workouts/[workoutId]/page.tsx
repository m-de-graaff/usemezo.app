import { getSession } from "@mezo/auth/server";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { FinishedWorkout } from "~/components/workouts/finished-workout";
import { LiveWorkout } from "~/components/workouts/live-workout";
import { api } from "~/trpc/server";

export const metadata: Metadata = { title: "Workout" };

/**
 * One session, live or finished.
 *
 * Both are this URL because both are the same row. Somebody who bookmarks a
 * workout should not have to know which of the two it has become since.
 */
export default async function WorkoutPage({
	params,
}: {
	params: Promise<{ workoutId: string }>;
}) {
	// The proxy only sees a cookie; this is the real check.
	const session = await getSession();
	if (!session) redirect("/sign-in?callbackURL=/workouts");

	const { workoutId } = await params;
	const [workout, profile] = await Promise.all([
		api.workout.workout({ id: workoutId }),
		api.profile.get(),
	]);

	// Null covers both "no such workout" and "not yours". They look the same from
	// here on purpose.
	if (!workout) notFound();

	return workout.finishedAt ? (
		<FinishedWorkout units={profile.units} workout={workout} />
	) : (
		<LiveWorkout
			profile={{
				birthDate: profile.birthDate,
				bodyFatPercent: profile.bodyFatPercent,
				fitnessExperience: profile.fitnessExperience,
				gender: profile.gender,
				heightCm: profile.heightCm,
				weightKg: profile.weightKg,
			}}
			units={profile.units}
			workout={workout}
		/>
	);
}
