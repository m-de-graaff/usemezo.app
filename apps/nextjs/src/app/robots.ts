import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
	return {
		rules: {
			userAgent: "*",
			// Everything behind sign-in is a redirect to a crawler, and profiles
			// at /@name carry their own `noindex`. Only the pitch is public.
			allow: "/",
			disallow: [
				"/api/",
				"/dashboard",
				"/milo",
				"/onboarding",
				"/settings",
				"/workouts",
				"/debug",
			],
		},
	};
}
