"use client";

import { makeAssistantToolUI } from "@assistant-ui/react";
import type { ProfileInput } from "@mezo/api/profile-fields";
import { Button } from "@mezo/ui/button";
import { cn } from "@mezo/ui/lib/utils";
import { toast } from "@mezo/ui/sonner";
import { ArrowRightIcon, CheckIcon, PencilIcon, XIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { unitSystem } from "~/lib/measure";
import { displayParts, miloField, type ProfileChange } from "~/lib/milo";
import { api } from "~/trpc/react";

/**
 * The card behind `proposeProfileUpdate`.
 *
 * Milo has no way to write to the profile: the tool it calls has no `execute`,
 * so the run stops here and waits for this component to hand back a result.
 * Apply goes through `profile.update` like the settings form does, which means
 * `profileInput` validates the model's numbers exactly as it validates a human's
 * — a hallucinated 400 kg bounces off the same bound either way.
 */

type Args = { changes: ProfileChange[] };

type Result =
	| { applied: true; changes: string[] }
	| { applied: false; reason: string };

export const ProfileChangeToolUI = makeAssistantToolUI<Args, Result>({
	toolName: "proposeProfileUpdate",
	render: function ProfileChangeCard({ args, status, result, addResult }) {
		const router = useRouter();
		const profile = api.profile.get.useQuery();
		const system = unitSystem(profile.data?.units);

		const update = api.profile.update.useMutation({
			onSuccess: (_data, submitted) => {
				const names = Object.keys(submitted);
				toast.success(
					names.length === 1
						? `${miloField(names[0] ?? "")?.label ?? "Setting"} saved.`
						: `${names.length} settings saved.`,
				);
				void profile.refetch();
				// The header and any server-rendered figure read the same row.
				router.refresh();
				addResult({ applied: true, changes: names });
			},
			onError: (error) => {
				// A validation failure arrives as a JSON-encoded issue array in
				// `message`; the flattened field errors are the readable half.
				const first = Object.values(error.data?.zodError?.fieldErrors ?? {})
					.flat()
					.find((message): message is string => typeof message === "string");
				const reason = first ?? error.message;
				toast.error(reason);
				// Told to the model too, so it can correct itself rather than
				// insisting the change went through.
				addResult({ applied: false, reason: `Rejected: ${reason}` });
			},
		});

		// While the arguments are still streaming in there is nothing stable to
		// show, and a half-built list of changes reads as a different proposal.
		const changes = Array.isArray(args?.changes) ? args.changes : [];
		if (status.type === "running" || changes.length === 0) {
			return <CardShell>Working out what to change…</CardShell>;
		}

		const settled = result !== undefined;
		const applied = settled && result.applied;

		return (
			<CardShell>
				<div className="flex items-center gap-2 border-b px-4 py-2.5">
					<PencilIcon className="size-3.5 text-muted-foreground" />
					<h3 className="font-medium text-sm">
						{applied
							? "Saved to your profile"
							: settled
								? "Not saved"
								: changes.length === 1
									? "Milo suggests a change"
									: `Milo suggests ${changes.length} changes`}
					</h3>
				</div>

				<ul className="divide-y">
					{changes.map((change) => {
						const field = miloField(change.field);
						if (!field) return null;

						const before = displayParts(
							field,
							profile.data?.[change.field as keyof typeof profile.data] ?? null,
							system,
						);
						const after = displayParts(field, change.value, system);

						return (
							<li className="px-4 py-3" key={change.field}>
								<div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
									<span className="font-medium text-sm">{field.label}</span>
									<span className="text-muted-foreground text-sm tabular-nums line-through">
										{before.text}
										{before.unit && ` ${before.unit}`}
									</span>
									<ArrowRightIcon className="size-3 shrink-0 text-muted-foreground" />
									<span
										className={cn(
											"font-medium text-sm tabular-nums",
											applied && "text-foreground",
										)}
									>
										{after.text}
										{after.unit && ` ${after.unit}`}
									</span>
								</div>
								{change.reason && (
									<p className="mt-1 text-muted-foreground text-xs leading-relaxed">
										{change.reason}
									</p>
								)}
							</li>
						);
					})}
				</ul>

				{settled ? (
					<p className="flex items-center gap-1.5 border-t px-4 py-2.5 text-muted-foreground text-xs">
						{applied ? (
							<CheckIcon className="size-3.5" />
						) : (
							<XIcon className="size-3.5" />
						)}
						{applied ? "Applied." : "Discarded, nothing was written."}
					</p>
				) : (
					<div className="flex items-center justify-end gap-2 border-t px-4 py-2.5">
						<Button
							disabled={update.isPending}
							onClick={() =>
								addResult({
									applied: false,
									reason: "The user discarded these changes.",
								})
							}
							size="sm"
							variant="ghost"
						>
							Discard
						</Button>
						<Button
							disabled={update.isPending}
							onClick={() => update.mutate(toProfileInput(changes))}
							size="sm"
						>
							{update.isPending ? "Saving…" : "Apply"}
						</Button>
					</div>
				)}
			</CardShell>
		);
	},
});

/**
 * A partial update, which is exactly what `profile.update` expects: a key that
 * is absent survives untouched, and an explicit `null` clears the answer.
 *
 * The cast is the one place this file admits the model's values are unchecked.
 * It is safe because nothing here writes: `profileInput` re-parses every key on
 * the server, and a wrong type comes back as a rejection the card shows.
 */
const toProfileInput = (changes: ProfileChange[]) =>
	Object.fromEntries(
		changes.map((change) => [change.field, change.value]),
	) as ProfileInput;

const CardShell = ({ children }: { children: React.ReactNode }) => (
	<div className="my-2 overflow-hidden rounded-xl border bg-card text-card-foreground">
		{typeof children === "string" ? (
			<p className="px-4 py-3 text-muted-foreground text-sm">{children}</p>
		) : (
			children
		)}
	</div>
);
