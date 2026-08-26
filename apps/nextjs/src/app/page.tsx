import { getSession } from "@mezo/auth/server";
import { redirect } from "next/navigation";
import { Landing } from "~/components/landing";

// Only on the pitch: `alternates` is inherited, so setting it on the root
// layout would point every page at "/".
export const metadata = { alternates: { canonical: "/" } };

export default async function Home() {
	// The landing page is a pitch; a signed-in user has already bought it.
	if (await getSession()) redirect("/dashboard");

	return <Landing />;
}
