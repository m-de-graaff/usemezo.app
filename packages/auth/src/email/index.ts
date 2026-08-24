import "server-only";

import { env } from "@mezo/env";
import { render } from "@react-email/render";
import { createTransport } from "nodemailer";
import { Resend } from "resend";
import { ActionEmail, type ActionEmailProps } from "./action-email";

/**
 * Resend when an API key is configured, otherwise SMTP — which in development
 * points at a local Mailpit so nothing ever leaves the machine.
 */
async function deliver(to: string, subject: string, html: string) {
	if (env.RESEND_API_KEY) {
		const { error } = await new Resend(env.RESEND_API_KEY).emails.send({
			from: env.EMAIL_FROM,
			to,
			subject,
			html,
		});
		if (error) throw new Error(`Resend refused the email: ${error.message}`);
		return;
	}

	await createTransport(env.SMTP_URL).sendMail({
		from: env.EMAIL_FROM,
		to,
		subject,
		html,
	});
}

export async function sendActionEmail(
	to: string,
	subject: string,
	props: ActionEmailProps,
) {
	// `pretty: false` means prettier is never actually called, but it stays in
	// @react-email/render's module graph — hence prettier as a devDependency.
	const html = await render(ActionEmail(props), { pretty: false });
	await deliver(to, subject, html);
}
