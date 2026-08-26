/**
 * The row of numbers at the top of a session or a routine.
 *
 * One component for all three screens, because the numbers on them mean the
 * same thing and a reader moving between them should not have to re-learn where
 * they are. A live session says how long it has been, a finished one says how
 * long it took, and a routine says how long it should take.
 *
 * `tabular-nums` on the values is not decoration. The elapsed clock and the
 * running volume both change while somebody is looking at them, and
 * proportional digits make the whole row twitch on every tick.
 */
export function Stats({
	items,
}: {
	items: { label: string; value: React.ReactNode }[];
}) {
	return (
		<dl className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
			{items.map((item) => (
				<div key={item.label}>
					<dt className="text-muted-foreground text-xs">{item.label}</dt>
					<dd className="tabular-nums">{item.value}</dd>
				</div>
			))}
		</dl>
	);
}
