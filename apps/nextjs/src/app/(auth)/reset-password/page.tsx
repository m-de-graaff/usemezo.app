import { Button } from "@mezo/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@mezo/ui/card";
import Link from "next/link";
import { ResetPasswordForm } from "~/components/reset-password-form";

export const metadata = { title: "Reset password" };

export default async function ResetPasswordPage({
	searchParams,
}: {
	searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
	// Better Auth's callback lands here with `?token=` on success and
	// `?error=INVALID_TOKEN` when the link is stale.
	const { token } = await searchParams;

	if (typeof token !== "string" || token === "") {
		return (
			<Card className="w-full max-w-sm">
				<CardHeader>
					<CardTitle>This link is no longer valid</CardTitle>
					<CardDescription>
						Reset links expire after an hour and can only be used once.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<Button render={<Link href="/forgot-password" />}>
						Request a new link
					</Button>
				</CardContent>
			</Card>
		);
	}

	return <ResetPasswordForm token={token} />;
}
