import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
	return {
		name: "Mezo: training, nutrition and sleep in one app",
		short_name: "Mezo",
		description:
			"Track your lifts, macros, hydration and sleep in one place, and see what is actually moving the needle.",
		// Installed from the home screen, the app itself is the destination;
		// the landing page redirects a signed-in user there anyway.
		start_url: "/dashboard",
		display: "standalone",
		background_color: "#0a0a0a",
		theme_color: "#0a0a0a",
		icons: [
			{ src: "/icon.svg", type: "image/svg+xml", sizes: "any" },
			{ src: "/apple-icon", type: "image/png", sizes: "180x180" },
		],
	};
}
