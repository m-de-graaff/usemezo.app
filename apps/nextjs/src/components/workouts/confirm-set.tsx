"use client";

import { Button } from "@mezo/ui/button";
import { toast } from "@mezo/ui/sonner";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "~/trpc/react";

/**
 * The appeal, such as it is: one button on the one row that needs it.
 *
 * A set the plausibility check doubted keeps its place in the log and loses
 * only its claim on a record. This is how the person who was actually in the
 * gym gets that back, and it is deliberately the whole of the process. There is
 * nobody to write to, no form, no wait: the app made a guess about a number and
 * the only human who knows the answer is looking at it.
 *
 * The row is left on screen after the write rather than re-rendered away. The
 * server settles it on the next load; taking the line out from under somebody's
 * thumb the instant they tap is how a tap gets repeated on whatever moved into
 * its place.
 */
export function ConfirmSet({
	index,
	setKey,
	workoutId,
}: {
	index: number;
	setKey: string;
	workoutId: string;
}) {
	const router = useRouter();
	const [done, setDone] = useState(false);

	const confirm = api.workout.confirmSet.useMutation({
		onSuccess: () => {
			setDone(true);
			toast.success("Counted. It can hold a record again.");
			router.refresh();
		},
		onError: (error) => toast.error(error.message),
	});

	if (done) return null;

	return (
		<Button
			className="h-auto px-1.5 py-0 text-xs"
			disabled={confirm.isPending}
			onClick={() => confirm.mutate({ id: workoutId, index, key: setKey })}
			size="sm"
			variant="ghost"
		>
			It's right
		</Button>
	);
}
