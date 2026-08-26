import { ConsentForm } from "~/components/consent-form";

export const metadata = { title: "Authorise app" };

export default async function ConsentPage({
	searchParams,
}: {
	searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
	const params = await searchParams;
	const first = (key: string) => {
		const value = params[key];
		return Array.isArray(value) ? value[0] : value;
	};

	return (
		<ConsentForm
			clientId={first("client_id") ?? ""}
			// The endpoint replays the original request from this query string.
			oauthQuery={new URLSearchParams(
				Object.entries(params).flatMap(([key, value]) =>
					value === undefined
						? []
						: Array.isArray(value)
							? value.map((v) => [key, v] as [string, string])
							: [[key, value] as [string, string]],
				),
			).toString()}
			scopes={(first("scope") ?? "").split(" ").filter(Boolean)}
		/>
	);
}
