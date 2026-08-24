"use client";

import { Button } from "@mezo/ui/button";
import { ThemeToggle } from "@mezo/ui/theme";
import {
	ArrowRight,
	Droplet,
	Dumbbell,
	Flame,
	Moon,
	Search,
} from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { Logo } from "./logo";

// Strong ease-out — the built-in CSS curves are too weak to read as deliberate.
const EASE_OUT = [0.23, 1, 0.32, 1] as const;

const rise = {
	hidden: { opacity: 0, y: 16 },
	show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE_OUT } },
};

const stage = {
	hidden: {},
	show: { transition: { staggerChildren: 0.06, delayChildren: 0.05 } },
};

export function Landing() {
	const reduced = useReducedMotion();

	return (
		<div className="min-h-screen bg-muted/60 p-3 sm:p-5">
			<motion.header
				animate={{ opacity: 1, y: 0 }}
				className="mx-auto flex max-w-6xl items-center justify-between px-3 py-4 sm:px-6"
				initial={{ opacity: 0, y: reduced ? 0 : -12 }}
				transition={{ duration: 0.5, ease: EASE_OUT }}
			>
				<Link
					className="rounded-md font-semibold text-lg tracking-tight outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
					href="/"
				>
					<Logo />
				</Link>
				<div className="flex items-center gap-1">
					<ThemeToggle className="rounded-full" />
					<Button
						className="h-9 rounded-full px-4"
						render={<Link href="/sign-up" />}
						variant="outline"
					>
						Get started
					</Button>
				</div>
			</motion.header>

			<motion.main
				animate="show"
				className="mx-auto max-w-6xl overflow-hidden rounded-3xl bg-background px-4 pt-12 pb-0 shadow-sm sm:px-8"
				initial="hidden"
				variants={stage}
			>
				<div className="mx-auto flex max-w-3xl flex-col items-center text-center">
					<motion.p
						className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 font-medium text-muted-foreground text-xs"
						variants={rise}
					>
						<Dumbbell aria-hidden="true" className="size-3.5" />
						Lift, eat, sleep, repeat
					</motion.p>

					<motion.h1
						className="mt-6 text-balance font-semibold text-4xl tracking-tight sm:text-6xl"
						variants={rise}
					>
						<span className="text-muted-foreground">Your Strongest Year</span>{" "}
						<span>Starts Here</span>
					</motion.h1>

					<motion.p
						className="mt-5 max-w-xl text-balance text-muted-foreground sm:text-lg"
						variants={rise}
					>
						Every set, every gram, every glass of water and every hour of sleep,
						tracked in one place, so you can see what is actually moving the
						needle.
					</motion.p>

					<motion.div className="mt-7 flex gap-2" variants={rise}>
						<Button
							className="h-10 rounded-full px-5"
							render={<Link href="/sign-up" />}
						>
							Start tracking free
							<ArrowRight aria-hidden="true" />
						</Button>
						<Button
							className="h-10 rounded-full px-5"
							render={<Link href="/sign-in" />}
							variant="ghost"
						>
							Sign in
						</Button>
					</motion.div>
				</div>

				<Showcase reduced={Boolean(reduced)} />
			</motion.main>
		</div>
	);
}

/** The device mock and the cards orbiting it. Decorative — hidden from AT. */
function Showcase({ reduced }: { reduced: boolean }) {
	return (
		<div
			aria-hidden="true"
			className="relative mx-auto mt-10 h-[20rem] w-full max-w-5xl select-none sm:h-[24rem]"
		>
			<motion.div
				animate={{ opacity: 1, y: 0, scale: 1 }}
				className="absolute bottom-0 left-1/2 w-60 -translate-x-1/2 rounded-[2rem] border-2 border-foreground/90 bg-background p-3 shadow-xl"
				initial={{ opacity: 0, y: reduced ? 0 : 40, scale: reduced ? 1 : 0.96 }}
				transition={{ duration: 0.7, delay: 0.25, ease: EASE_OUT }}
			>
				<div className="flex items-center gap-2 pb-3">
					<p className="flex-1 font-medium text-sm">
						<span className="text-muted-foreground">Hey, </span>Mark!
					</p>
					<Search className="size-4 text-muted-foreground" />
				</div>
				<div className="rounded-2xl bg-muted p-3">
					<p className="font-medium text-[0.65rem] text-muted-foreground">
						Today · Push
					</p>
					<p className="mt-6 font-semibold text-xl leading-tight">
						Bench, Press
						<br />& Dips
					</p>
					<p className="mt-1 text-[0.7rem] text-muted-foreground">
						6 exercises · 48 min
					</p>
					<div className="mt-3 rounded-full bg-foreground px-3 py-2 text-center font-medium text-[0.7rem] text-background">
						Start workout
					</div>
				</div>
				<div className="flex items-center justify-between pt-3 font-medium text-[0.7rem] text-muted-foreground">
					<span>This week</span>
					<span>3 of 5</span>
				</div>
			</motion.div>

			<FloatCard
				className="top-2 left-0 w-56 sm:top-8"
				delay={0.45}
				reduced={reduced}
			>
				<div className="flex items-start gap-3">
					<Avatar name="DK" />
					<div>
						<p className="font-semibold text-sm">Davis Korsgaard</p>
						<p className="text-muted-foreground text-xs leading-snug">
							Put 12 kg on his squat in ten weeks.
						</p>
					</div>
				</div>
			</FloatCard>

			<FloatCard className="bottom-36 left-0" delay={0.8} reduced={reduced}>
				<div className="flex items-center gap-2">
					<Flame className="size-4 text-muted-foreground" />
					<div>
						<p className="text-[0.65rem] text-muted-foreground">Protein</p>
						<p className="font-semibold text-sm">148 / 165 g</p>
					</div>
				</div>
			</FloatCard>

			<FloatCard className="bottom-14 left-8" delay={0.6} reduced={reduced}>
				<div className="flex items-center gap-2">
					<Droplet className="size-4 text-muted-foreground" />
					<div>
						<p className="text-[0.65rem] text-muted-foreground">Hydration</p>
						<p className="font-semibold text-sm">2.1 / 3.0 L</p>
					</div>
				</div>
			</FloatCard>

			<FloatCard
				className="top-4 right-0 sm:top-10"
				delay={0.55}
				reduced={reduced}
			>
				<p className="pb-2 font-medium text-[0.65rem] text-muted-foreground">
					Weekly volume
				</p>
				<div className="flex h-14 items-end gap-1.5">
					{BARS.map((bar) => (
						<span
							className="w-3 rounded-full bg-emerald-500"
							key={bar.day}
							style={{ height: `${bar.height}%` }}
						/>
					))}
				</div>
			</FloatCard>

			<FloatCard className="right-6 bottom-20" delay={0.7} reduced={reduced}>
				<div className="flex items-center gap-2">
					<Moon className="size-4 text-muted-foreground" />
					<div>
						<p className="text-[0.65rem] text-muted-foreground">Sleep</p>
						<p className="font-semibold text-sm">7h 42m</p>
					</div>
				</div>
			</FloatCard>
		</div>
	);
}

const BARS = [
	{ day: "mon", height: 45 },
	{ day: "tue", height: 70 },
	{ day: "wed", height: 35 },
	{ day: "thu", height: 85 },
	{ day: "fri", height: 60 },
	{ day: "sat", height: 100 },
];

function FloatCard({
	children,
	className,
	delay,
	reduced,
}: {
	children: React.ReactNode;
	className: string;
	delay: number;
	reduced: boolean;
}) {
	return (
		<motion.div
			animate={{ opacity: 1, scale: 1 }}
			className={`absolute hidden md:block ${className}`}
			initial={{ opacity: 0, scale: reduced ? 1 : 0.94 }}
			transition={{ duration: 0.5, delay, ease: EASE_OUT }}
		>
			<motion.div
				animate={reduced ? undefined : { y: [0, -6, 0] }}
				className="rounded-2xl border border-border bg-background p-3 shadow-lg"
				transition={{
					duration: 5,
					delay,
					repeat: Number.POSITIVE_INFINITY,
					ease: "easeInOut",
				}}
			>
				{children}
			</motion.div>
		</motion.div>
	);
}

function Avatar({ name }: { name: string }) {
	return (
		<span className="flex size-8 items-center justify-center rounded-full bg-muted font-medium text-[0.65rem] text-muted-foreground">
			{name}
		</span>
	);
}
