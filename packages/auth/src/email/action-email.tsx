import {
	Body,
	Button,
	Container,
	Head,
	Heading,
	Html,
	Link,
	Preview,
	Section,
	Text,
} from "@react-email/components";

export type ActionEmailProps = {
	preview: string;
	heading: string;
	body: string;
	buttonLabel: string;
	url: string;
	expiresInMinutes: number;
};

/**
 * Every transactional email we send is "read this, click this button". One
 * template covers verification and password reset; split it when a mail needs
 * a genuinely different shape.
 */
export function ActionEmail({
	preview,
	heading,
	body,
	buttonLabel,
	url,
	expiresInMinutes,
}: ActionEmailProps) {
	return (
		<Html lang="en">
			<Head />
			<Preview>{preview}</Preview>
			<Body style={styles.body}>
				<Container style={styles.container}>
					<Heading style={styles.heading}>{heading}</Heading>
					<Text style={styles.text}>{body}</Text>
					<Section style={styles.buttonSection}>
						<Button href={url} style={styles.button}>
							{buttonLabel}
						</Button>
					</Section>
					<Text style={styles.muted}>
						This link expires in {expiresInMinutes} minutes. If the button does
						not work, paste this into your browser:
					</Text>
					<Link href={url} style={styles.link}>
						{url}
					</Link>
					<Text style={styles.muted}>
						If you did not request this, you can ignore this email.
					</Text>
				</Container>
			</Body>
		</Html>
	);
}

// Inline styles, because email clients ignore stylesheets.
const styles = {
	body: {
		backgroundColor: "#f6f6f6",
		fontFamily:
			"-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
		padding: "24px 0",
	},
	container: {
		backgroundColor: "#ffffff",
		border: "1px solid #e5e5e5",
		borderRadius: "8px",
		margin: "0 auto",
		maxWidth: "480px",
		padding: "32px",
	},
	heading: { fontSize: "20px", fontWeight: 600, margin: "0 0 16px" },
	text: { color: "#404040", fontSize: "14px", lineHeight: "22px", margin: "0" },
	buttonSection: { margin: "24px 0" },
	button: {
		backgroundColor: "#171717",
		borderRadius: "8px",
		color: "#ffffff",
		display: "inline-block",
		fontSize: "14px",
		fontWeight: 500,
		padding: "10px 20px",
		textDecoration: "none",
	},
	muted: {
		color: "#737373",
		fontSize: "12px",
		lineHeight: "18px",
		margin: "16px 0 4px",
	},
	link: { color: "#525252", fontSize: "12px", wordBreak: "break-all" as const },
};

export default ActionEmail;
