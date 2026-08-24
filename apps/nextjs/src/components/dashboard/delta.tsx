import { Badge } from "@mezo/ui/badge";
import { cn } from "@mezo/ui/lib/utils";
import { MinusIcon, TrendingDownIcon, TrendingUpIcon } from "lucide-react";

/**
 * A period-over-period change. `lowerIsBetter` flips the colour without
 * flipping the arrow — resting heart rate falling is good news pointing down.
 */
export function Delta({
	value,
	lowerIsBetter = false,
	badge = false,
	className,
}: {
	value: number;
	lowerIsBetter?: boolean;
	badge?: boolean;
	className?: string;
}) {
	const Icon =
		value === 0 ? MinusIcon : value > 0 ? TrendingUpIcon : TrendingDownIcon;
	const good = lowerIsBetter ? value < 0 : value > 0;
	const tone =
		value === 0
			? "text-muted-foreground"
			: good
				? "text-emerald-600 dark:text-emerald-400"
				: "text-rose-600 dark:text-rose-400";

	const body = (
		<>
			<Icon />
			{Math.abs(value).toFixed(1)}%
		</>
	);

	if (badge) {
		return (
			<Badge
				className={cn(
					"gap-1 border-none tabular-nums",
					value === 0
						? "bg-muted"
						: good
							? "bg-emerald-500/10"
							: "bg-rose-500/10",
					tone,
					className,
				)}
				variant="secondary"
			>
				{body}
			</Badge>
		);
	}

	return (
		<span
			className={cn(
				"inline-flex items-center gap-1 tabular-nums [&>svg]:size-3",
				tone,
				className,
			)}
		>
			{body}
		</span>
	);
}
