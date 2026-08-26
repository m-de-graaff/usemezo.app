import "@mezo/ui/globals.css";

import { env } from "@mezo/env";
import { Toaster } from "@mezo/ui/sonner";
import { ThemeProvider } from "@mezo/ui/theme";
import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import { TRPCReactProvider } from "~/trpc/react";

const TITLE = "Mezo: training, nutrition and sleep in one app";
const DESCRIPTION =
	"Track your lifts, macros, hydration and sleep in one place, and see what is actually moving the needle.";

export const metadata: Metadata = {
	// The same origin Better Auth builds its callbacks from, so relative
	// metadata URLs (og:image, canonical) resolve without a second variable.
	metadataBase: new URL(env.BETTER_AUTH_URL),
	// Pages set their own bare title; the suffix is added here once.
	title: { default: TITLE, template: "%s | Mezo" },
	description: DESCRIPTION,
	applicationName: "Mezo",
	openGraph: {
		type: "website",
		siteName: "Mezo",
		title: TITLE,
		description: DESCRIPTION,
		url: "/",
		locale: "en_US",
	},
	// No twitter.images: Next reuses opengraph-image.tsx for both.
	twitter: {
		card: "summary_large_image",
		title: TITLE,
		description: DESCRIPTION,
	},
};

export const viewport: Viewport = {
	themeColor: [
		{ media: "(prefers-color-scheme: light)", color: "#ffffff" },
		{ media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
	],
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
