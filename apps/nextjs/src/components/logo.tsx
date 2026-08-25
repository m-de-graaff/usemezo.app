export const BARS = [
	{ x: 2, y: 11, height: 10 },
	{ x: 7.2, y: 5, height: 16 },
	{ x: 12.4, y: 15, height: 6 },
	{ x: 17.6, y: 8, height: 13 },
];

export function LogoMark({ className }: { className?: string }) {
	return (
		<svg
			aria-hidden="true"
			className={className}
			fill="currentColor"
			focusable="false"
			viewBox="0 0 24 24"
			xmlns="http://www.w3.org/2000/svg"
		>
			{BARS.map((bar) => (
				<rect key={bar.x} rx="1" width="3.6" {...bar} />
			))}
		</svg>
	);
}

export function Logo({ className }: { className?: string }) {
	return (
		<span className={`inline-flex items-center gap-2 ${className ?? ""}`}>
			<LogoMark className="size-[1.1em]" />
			<span className="font-semibold tracking-tight">mezo</span>
		</span>
	);
}
