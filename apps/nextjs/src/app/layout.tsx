import "@mezo/ui/globals.css";

import { Toaster } from "@mezo/ui/sonner";
import { ThemeProvider } from "@mezo/ui/theme";
import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { TRPCReactProvider } from "~/trpc/react";

export const metadata: Metadata = {
	title: "Mezo: training, nutrition and sleep in one app",
	description:
		"Track your lifts, macros, hydration and sleep in one place, and see what is actually moving the needle.",
	icons: [{ rel: "icon", url: "/favicon.ico" }],
};

const geist = Geist({
	subsets: ["latin"],
	variable: "--font-geist-sans",
});

export default function RootLayout({
	children,
}: Readonly<{ children: React.ReactNode }>) {
	return (
		// next-themes writes the class on <html> before paint, which the server
		// render cannot know about.
		<html className={`${geist.variable}`} lang="en" suppressHydrationWarning>
			<body>
				<ThemeProvider>
					<TRPCReactProvider>{children}</TRPCReactProvider>
					<Toaster position="bottom-right" richColors />
				</ThemeProvider>
			</body>
		</html>
	);
}
