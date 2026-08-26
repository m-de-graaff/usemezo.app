"use client";

import { drinkBySlug } from "@mezo/api/hydration";
import { Button } from "@mezo/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@mezo/ui/card";
import { toast } from "@mezo/ui/sonner";
import { XIcon } from "lucide-react";
import { formatVolume, type UnitSystem } from "~/lib/measure";
import { api } from "~/trpc/react";

export type Entry = {
	id: string;
	amountMl: number;
	drink: string;
	loggedAt: Date;
	effectiveMl: number;
};

const time = (at: Date) =>
	at.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

/**
 * Today's drinks, newest at the top, each one removable.
 *
 * The removable part is the reason drinks are rows rather than a running total:
 * the thing everybody does with a tap-counter is tap it by accident.
 */
export function DrinkLog({
	entries,
	system,
}: {
	entries: Entry[];
	system: UnitSystem;
}) {
	const utils = api.useUtils();
	const remove = api.hydration.remove.useMutation({
		onError: (error) => toast.error(error.message),
		onSettled: () => utils.hydration.overview.invalidate(),
	});

	return (
		<Card className="shadow-none dark:ring-0">
			<CardHeader className="space-y-1">
				<CardTitle>Today</CardTitle>
				<CardDescription>
					What you drank, and what it counted for.
				</CardDescription>
			</CardHeader>
			<CardContent>
				{entries.length === 0 ? (
					<p className="py-6 text-center text-muted-foreground text-sm">
						Nothing logged yet today.
					</p>
				) : (
					<ul className="flex flex-col divide-y">
						{[...entries].reverse().map((entry) => {
							const drink = drinkBySlug(entry.drink);
							// Anything but plain water is worth saying twice: the glass,
							// and what the glass was worth after its hydration index.
							const adjusted = entry.effectiveMl !== entry.amountMl;

							return (
								<li
									className="flex items-center gap-3 py-2 text-sm"
									key={entry.id}
								>
									<span className="w-12 shrink-0 text-muted-foreground tabular-nums">
										{time(entry.loggedAt)}
									</span>
									<span className="min-w-0 flex-1 truncate">
										{drink?.label ?? entry.drink}
									</span>
									<span className="shrink-0 tabular-nums">
										{formatVolume(entry.amountMl, system)}
										{adjusted && (
											<span className="text-muted-foreground">
												{" → "}
												{formatVolume(entry.effectiveMl, system)}
											</span>
										)}
									</span>
									<Button
										aria-label={`Remove ${drink?.label ?? entry.drink} at ${time(entry.loggedAt)}`}
										disabled={remove.isPending}
										onClick={() => remove.mutate({ id: entry.id })}
										size="icon-xs"
										variant="ghost"
									>
										<XIcon aria-hidden="true" />
									</Button>
								</li>
							);
						})}
					</ul>
				)}
			</CardContent>
		</Card>
	);
}
