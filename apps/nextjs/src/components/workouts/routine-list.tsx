"use client";

import {
	estimatedSec,
	type RoutineExercise,
	setCount,
} from "@mezo/api/workout-shape";
import { Button } from "@mezo/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
	DropdownMenuTrigger,
} from "@mezo/ui/dropdown-menu";
import { Input } from "@mezo/ui/input";
import { cn } from "@mezo/ui/lib/utils";
import { toast } from "@mezo/ui/sonner";
import {
	ChevronRightIcon,
	CopyIcon,
	FolderIcon,
	FolderPlusIcon,
	GripVerticalIcon,
	MoreHorizontalIcon,
	PencilIcon,
	PlayIcon,
	PlusIcon,
	TrashIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type DragEvent, useState } from "react";
import { toastProgressed } from "~/components/workouts/progressed-toast";
import {
	formatDuration,
	summariseRoutine,
} from "~/components/workouts/summary";
import { api } from "~/trpc/react";

type Row = {
	id: string;
	name: string;
	folderId: string | null;
	exercises: RoutineExercise[];
};

type Folder = { id: string; name: string };

/**
 * Our own MIME type, so a folder lights up for a routine being dragged and for
 * nothing else somebody might drag across the page.
 */
const DRAG_TYPE = "application/x-mezo-routine";

/** The unfiled band's name as a drop target. Not a folder, so not an id. */
const UNFILED = "unfiled";

/**
 * Every routine, filed under the headings the user gave them.
 *
 * One bordered list rather than a grid of tiles, which is how every other list
 * in this app is drawn and what lets a dozen routines be read without
 * scrolling. A tile per routine spends most of its area on the space around
 * three words.
 *
 * A folder is a heading and nothing more: it holds no training, and a routine
 * that is in none of them is the ordinary case rather than a loose end, so the
 * unfiled ones open the list and every band below one of them names what it
 * opens.
 *
 * The rows carry no buttons. A routine is opened far more often than it is
 * started from here, and everything a routine can do is in its menu; the
 * routine's own screen is where Start is under your thumb.
 */
export function RoutineList({
	folders,
	hasLiveWorkout,
	routines,
}: {
	folders: Folder[];
	hasLiveWorkout: boolean;
	routines: Row[];
}) {
	const router = useRouter();

	/**
	 * Which folder name is being typed, if any. One at a time by construction:
	 * a rename and a new folder are the same box in two places, and two open at
	 * once is two answers to a question with one.
	 */
	const [naming, setNaming] = useState<{ id: string; name: string } | null>(
		null,
	);

	/**
	 * Which routine is being dragged, and which band is under it.
	 *
	 * One piece of state per question rather than a flag per target: `group` is
	 * called in a loop, so a `useState` inside it would be a different number of
	 * hooks on every render.
	 *
	 * `dragging` is not only for the highlight. It is what puts an unfiled band
	 * on screen when every routine is already in a folder, because a drag with
	 * nowhere to drop back to is a one-way door.
	 */
	const [dragging, setDragging] = useState<string | null>(null);
	const [over, setOver] = useState<string | null>(null);

	const refresh = () => router.refresh();

	const start = api.workout.start.useMutation({
		onSuccess: ({ id, progressed }) => {
			toastProgressed(progressed);
			router.push(`/workouts/${id}`);
		},
		onError: (error) => toast.error(error.message),
	});

	const copy = api.workout.copyRoutine.useMutation({
		// Straight into the routine. A duplicate is made to be changed, and the
		// first thing anybody changes is the name it was given.
		onSuccess: ({ id }) => router.push(`/workouts/routines/${id}`),
		onError: (error) => toast.error(error.message),
	});

	const remove = api.workout.removeRoutine.useMutation({
		onSuccess: () => {
			toast.success("Routine deleted.");
			refresh();
		},
		onError: (error) => toast.error(error.message),
	});

	const move = api.workout.moveRoutine.useMutation({
		onSuccess: refresh,
		onError: (error) => toast.error(error.message),
	});

	const saveFolder = api.workout.saveFolder.useMutation({
		onSuccess: () => {
			setNaming(null);
			refresh();
		},
		onError: (error) => toast.error(error.message),
	});

	const removeFolder = api.workout.removeFolder.useMutation({
		onSuccess: () => {
			// The routines under it are still there, further down the same list.
			// Saying so is the difference between a heading gone and training gone.
			toast.success("Folder deleted. Its routines are still here.");
			refresh();
		},
		onError: (error) => toast.error(error.message),
	});

	const accepts = (event: DragEvent) =>
		event.dataTransfer.types.includes(DRAG_TYPE);

	/**
	 * What makes one band a place to drop a routine.
	 *
	 * `target` names the band for the highlight and `folderId` is where the
	 * routine lands, which are two different things: the unfiled band has no id
	 * of its own and files a routine under nothing.
	 *
	 * Events bubble, so a folder's rows are part of its target for free —
	 * dropping onto a routine already in a folder files yours alongside it,
	 * which is what anybody aiming at a list of rows expects.
	 */
	const dropTo = (target: string, folderId: string | null) => ({
		onDragLeave: (event: DragEvent) => {
			// `dragleave` fires on the way into a child as well as on the way out
			// of the band. Without this the highlight strobes as the pointer
			// crosses every row.
			if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
				return;
			}
			setOver((current) => (current === target ? null : current));
		},
		onDragOver: (event: DragEvent) => {
			if (!accepts(event)) return;
			// Without this the browser refuses the drop and runs its own animation
			// of the row springing back.
			event.preventDefault();
			event.dataTransfer.dropEffect = "move";
			setOver(target);
		},
		onDrop: (event: DragEvent) => {
			if (!accepts(event)) return;
			event.preventDefault();
			setOver(null);
			setDragging(null);

			const id = event.dataTransfer.getData(DRAG_TYPE);
			const moving = routines.find((routine) => routine.id === id);
			// Already there. A write that changes nothing is still a write, and a
			// refresh nobody asked for.
			if (!moving || moving.folderId === folderId) return;
			move.mutate({ id, folderId });
		},
	});

	const row = (routine: Row) => {
		const sets = setCount(routine.exercises);

		return (
			<li
				className={cn(
					"relative flex items-center gap-3 px-4 py-3 hover:bg-muted",
					// The row you are holding, so a drag over a long list still says
					// what is in your hand.
					dragging === routine.id && "opacity-40",
				)}
				draggable
				key={routine.id}
				onDragEnd={() => {
					setDragging(null);
					setOver(null);
				}}
				onDragStart={(event) => {
					event.dataTransfer.setData(DRAG_TYPE, routine.id);
					event.dataTransfer.effectAllowed = "move";
					setDragging(routine.id);
				}}
			>
				{/* The whole row opens the routine and the menu sits above it. A link
				    that covers the row rather than a click handler on it: the name
				    stays in the tab order, the URL shows in the status bar, and
				    open-in-new-tab still works.
				    
				    `draggable={false}` because a link is draggable by default, and a
				    row that hands the browser a URL is a row that cannot be filed. */}
				<Link
					aria-label={`Open ${routine.name}`}
					className="absolute inset-0 focus-visible:outline-2 focus-visible:outline-ring focus-visible:-outline-offset-2"
					draggable={false}
					href={`/workouts/routines/${routine.id}`}
				/>

				{/* Hidden from assistive tech on purpose. It is a pointer shortcut for
				    "Move to" in the menu below, which is labelled, focusable and does
				    the same job; a control that can only be dragged is one a keyboard
				    user cannot operate at all (SC 2.5.7). */}
				<span
					aria-hidden="true"
					className="relative -ml-1 shrink-0 cursor-grab text-muted-foreground/50 transition-colors hover:text-foreground active:cursor-grabbing"
					title={`Drag ${routine.name} into a folder`}
				>
					<GripVerticalIcon className="size-4" />
				</span>

				<span className="min-w-0 flex-1">
					<span className="block truncate font-medium">{routine.name}</span>
					<span className="block truncate text-muted-foreground text-xs capitalize">
						{summariseRoutine(routine.exercises)}
					</span>
				</span>

				{routine.exercises.length > 0 && (
					<span className="shrink-0 text-right text-sm tabular-nums">
						<span className="block">
							{sets} {sets === 1 ? "set" : "sets"}
						</span>
						{/* Rest is most of a session, so six exercises is an hour. Better
						    to see that here than at the gym with somewhere to be. */}
						<span className="block text-muted-foreground text-xs">
							~{formatDuration(estimatedSec(routine.exercises))}
						</span>
					</span>
				)}

				<DropdownMenu>
					<DropdownMenuTrigger
						aria-label={`More for ${routine.name}`}
						className="relative z-10 -mr-1 inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
					>
						<MoreHorizontalIcon aria-hidden="true" className="size-4" />
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end">
						<DropdownMenuItem
							disabled={start.isPending || hasLiveWorkout}
							onClick={() =>
								start.mutate({
									id: crypto.randomUUID(),
									routineId: routine.id,
								})
							}
						>
							<PlayIcon aria-hidden="true" />
							Start
						</DropdownMenuItem>
						<DropdownMenuItem
							onClick={() =>
								router.push(`/workouts/routines/${routine.id}?edit=1`)
							}
						>
							<PencilIcon aria-hidden="true" />
							Edit
						</DropdownMenuItem>
						<DropdownMenuItem
							disabled={copy.isPending}
							onClick={() =>
								copy.mutate({ id: routine.id, newId: crypto.randomUUID() })
							}
						>
							<CopyIcon aria-hidden="true" />
							Duplicate
						</DropdownMenuItem>

						<DropdownMenuSub>
							<DropdownMenuSubTrigger>
								<FolderIcon aria-hidden="true" />
								Move to
							</DropdownMenuSubTrigger>
							<DropdownMenuSubContent>
								{folders.map((folder) => (
									<DropdownMenuItem
										disabled={folder.id === routine.folderId}
										key={folder.id}
										onClick={() =>
											move.mutate({ id: routine.id, folderId: folder.id })
										}
									>
										{folder.name}
									</DropdownMenuItem>
								))}
								{folders.length > 0 && <DropdownMenuSeparator />}
								<DropdownMenuItem
									disabled={routine.folderId === null}
									onClick={() =>
										move.mutate({ id: routine.id, folderId: null })
									}
								>
									No folder
								</DropdownMenuItem>
							</DropdownMenuSubContent>
						</DropdownMenuSub>

						<DropdownMenuSeparator />
						<DropdownMenuItem
							disabled={remove.isPending}
							onClick={() => remove.mutate({ id: routine.id })}
							variant="destructive"
						>
							<TrashIcon aria-hidden="true" />
							Delete
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</li>
		);
	};

	/** The box a folder is named in, whether it is being created or renamed. */
	const nameField = (id: string) => (
		<form
			className="flex gap-2 p-3"
			onSubmit={(event) => {
				event.preventDefault();
				const name = naming?.name.trim();
				if (name) saveFolder.mutate({ id, name });
			}}
		>
			{/* Focused on appearance: the box only exists because it was just asked
			    for, and it is the only thing on screen waiting for input. */}
			<Input
				aria-label="Folder name"
				autoFocus
				maxLength={80}
				onChange={(event) => setNaming({ id, name: event.target.value })}
				onKeyDown={(event) => {
					if (event.key === "Escape") setNaming(null);
				}}
				placeholder="Folder name"
				value={naming?.name ?? ""}
			/>
			<Button disabled={saveFolder.isPending} size="sm" type="submit">
				Save
			</Button>
			<Button
				onClick={() => setNaming(null)}
				size="sm"
				type="button"
				variant="ghost"
			>
				Cancel
			</Button>
		</form>
	);

	/**
	 * One heading and the rows under it. `details` rather than a state flag: the
	 * open and closed states, the keyboard handling and the announcement all
	 * come with the element, and none of it is ours to get wrong.
	 */
	const group = (folder: Folder, rows: Row[]) => {
		if (naming?.id === folder.id) {
			return <div key={folder.id}>{nameField(folder.id)}</div>;
		}

		return (
			// The menu is a sibling of the `details` laid over its heading, not a
			// child of the `summary`. Inside the summary every click on it is also a
			// click on the disclosure, and the only way to stop that is to cancel
			// the click the menu needs.
			<div
				className={cn(
					"relative transition-colors",
					over === folder.id && "bg-primary/10 ring-2 ring-primary ring-inset",
				)}
				key={folder.id}
				{...dropTo(folder.id, folder.id)}
			>
				<details className="group" open>
					<summary className="flex cursor-pointer list-none items-center gap-2 bg-muted/40 px-4 py-2 pr-12 text-muted-foreground text-xs hover:bg-muted">
						<ChevronRightIcon
							aria-hidden="true"
							className="size-3.5 shrink-0 transition-transform group-open:rotate-90"
						/>
						<span className="min-w-0 flex-1 truncate font-medium">
							{folder.name}
						</span>
						<span className="shrink-0 tabular-nums">{rows.length}</span>
					</summary>

					{rows.length === 0 ? (
						<p className="border-t px-4 py-3 text-muted-foreground text-sm">
							Nothing filed here yet. Drag a routine in, or move one from its
							menu.
						</p>
					) : (
						<ul className="divide-y border-t">{rows.map(row)}</ul>
					)}
				</details>

				<DropdownMenu>
					<DropdownMenuTrigger
						aria-label={`More for ${folder.name}`}
						className="absolute top-1 right-2 inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
					>
						<MoreHorizontalIcon aria-hidden="true" className="size-4" />
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end">
						<DropdownMenuItem
							onClick={() => setNaming({ id: folder.id, name: folder.name })}
						>
							<PencilIcon aria-hidden="true" />
							Rename
						</DropdownMenuItem>
						<DropdownMenuSeparator />
						<DropdownMenuItem
							disabled={removeFolder.isPending}
							onClick={() => removeFolder.mutate({ id: folder.id })}
							variant="destructive"
						>
							<TrashIcon aria-hidden="true" />
							Delete folder
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</div>
		);
	};

	const loose = routines.filter((routine) => routine.folderId === null);
	const naked = naming && !folders.some((folder) => folder.id === naming.id);

	return (
		<section className="flex flex-col gap-3">
			<div className="flex items-center justify-between gap-4">
				<h2 className="font-medium text-sm">Routines</h2>
				<div className="flex items-center gap-2">
					<Button
						onClick={() =>
							router.push(`/workouts/routines/${crypto.randomUUID()}`)
						}
						size="sm"
						variant="outline"
					>
						<PlusIcon aria-hidden="true" />
						New routine
					</Button>
					<Button
						aria-label="New folder"
						onClick={() => setNaming({ id: crypto.randomUUID(), name: "" })}
						size="icon-sm"
						variant="outline"
					>
						<FolderPlusIcon aria-hidden="true" />
					</Button>
				</div>
			</div>

			{routines.length === 0 && folders.length === 0 && !naked ? (
				<p className="rounded-xl border border-dashed p-6 text-center text-muted-foreground text-sm">
					No routines yet. Build one, or ask Milo for one.
				</p>
			) : (
				<div className="divide-y overflow-hidden rounded-xl border bg-card">
					{/* A brand new folder is named before it exists, so its box sits at
					    the top rather than in the section it is about to become. */}
					{naked ? nameField(naming.id) : null}

					{/* Unfiled first, and with no heading over them: a routine belongs
					    to no folder until somebody files it, so these are simply the
					    list, and every band below one of them names what it opens.
					    Putting them last instead leaves the rows after the final
					    folder looking like they are still inside it. */}
					{loose.length > 0 && (
						<div
							className={cn(
								"transition-colors",
								over === UNFILED &&
									"bg-primary/10 ring-2 ring-primary ring-inset",
							)}
							{...dropTo(UNFILED, null)}
						>
							<ul className="divide-y">{loose.map(row)}</ul>
						</div>
					)}

					{folders.map((folder) =>
						group(
							folder,
							routines.filter((routine) => routine.folderId === folder.id),
						),
					)}

					{/* Somewhere to drop a routine back out of a folder when every one
					    of them is already in one. It exists only during a drag: an
					    empty band on a settled screen is a row about nothing.
					    
					    Last rather than first, where the unfiled routines themselves
					    sit. A band that appears mid-drag has to appear somewhere that
					    moves nothing already on screen, and anything above the folders
					    would shift every one of them out from under the pointer that is
					    currently aiming at one. */}
					{loose.length === 0 && dragging !== null && (
						<div
							className={cn(
								"px-4 py-3 text-center text-muted-foreground text-sm transition-colors",
								over === UNFILED
									? "bg-primary/10 ring-2 ring-primary ring-inset"
									: "bg-muted/30",
							)}
							{...dropTo(UNFILED, null)}
						>
							Drop here to take it out of its folder
						</div>
					)}
				</div>
			)}
		</section>
	);
}
