import { getSession } from "@mezo/auth/server";
import { redirect } from "next/navigation";
import { Landing } from "~/components/landing";

export default async function Home() {
	// The landing page is a pitch; a signed-in user has already bought it.
	if (await getSession()) redirect("/dashboard");

	return <Landing />;
}
