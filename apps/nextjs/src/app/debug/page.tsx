import { LogoThinking } from "~/components/logo-thinking";

export const metadata = { title: "Debug" };

/** A scratch page for looking at things in isolation. Not linked from anywhere. */
export default function DebugPage() {
	return (
		<main className="mx-auto flex max-w-2xl flex-col gap-10 px-6 py-12">
			<header>
				<h1 className="font-medium text-2xl tracking-tight">Debug</h1>
				<p className="mt-1 text-muted-foreground text-sm">
					The thinking mark: the logo bars rearranging into m, e, z, o and back.
				</p>
			</header>

			<section className="flex flex-col gap-4">
				<h2 className="font-medium text-sm">Slow, for judging the morph</h2>
				<div className="flex items-center justify-center rounded-xl border border-border/60 bg-card p-10">
					<LogoThinking className="size-40" intervalMs={2200} />
				</div>
			</section>

			<section className="flex flex-col gap-4">
				<h2 className="font-medium text-sm">At the sizes it actually renders</h2>
				<div className="flex items-end gap-8 rounded-xl border border-border/60 bg-card p-10">
					{[
						{ className: "size-4", label: "16px" },
						{ className: "size-5", label: "20px" },
						{ className: "size-6", label: "24px" },
						{ className: "size-8", label: "32px" },
					].map((size) => (
						<div className="flex flex-col items-center gap-2" key={size.label}>
							<LogoThinking className={size.className} />
							<span className="text-muted-foreground text-xs">{size.label}</span>
						</div>
					))}
				</div>
			</section>
		</main>
	);
}
