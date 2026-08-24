import { AuthForm } from "~/components/auth-form";
import { safeCallbackURL } from "~/lib/callback-url";

export default async function SignUpPage({
	searchParams,
}: {
	searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
	const { callbackURL } = await searchParams;
	return <AuthForm callbackURL={safeCallbackURL(callbackURL)} mode="sign-up" />;
}
