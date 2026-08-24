import { ThemeToggle } from "@mezo/ui/theme";
import { Backdrop } from "~/components/backdrop";

export default function AuthLayout({
	children,
}: Readonly<{ children: React.ReactNode }>) {
	return (
		<main className="relative flex min-h-svh items-center justify-center px-4 py-10">
			<Backdrop />
			<ThemeToggle className="absolute top-4 right-4" />
			{children}
		</main>
	);
}
