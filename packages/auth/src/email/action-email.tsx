import { Body, Head, Html, Link, Preview } from "@react-email/components";

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
 *
 * Written against the low end of email client support, which is why it looks
 * nothing like the app's CSS:
 *
 * - Layout is nested tables at a fixed 600px. No flex, no `max-width` — the
 *   Word renderer behind Outlook on Windows supports neither.
 * - Every gap is cell padding. Not one `margin`: it is the most inconsistently
 *   honoured property in email, which is also why `Text`, `Container` and `Hr`
 *   from @react-email/components are not used here — they each emit one.
 * - `<body>` carries no styling (a third of clients drop it); the page colour
 *   is on a full-width wrapper table instead.
 * - The button is a bulletproof table cell, so the fill survives clients that
 *   collapse `display: inline-block` on an anchor.
 * - The fallback URL is an ordinary link, not `word-break: break-all`, which
 *   only 28% of clients support.
 * - `border-radius` is used only where square corners are a fine downgrade.
 *
 * What remains flagged is the three properties `Preview` needs to hide its
 * text — `display`, `overflow`, `opacity` — which is a fair trade for a
 * readable inbox preview line.
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
			<Body>
				<table
					cellPadding={0}
					cellSpacing={0}
					role="presentation"
					style={canvas}
					width="100%"
				>
					<tbody>
						<tr>
							<td align="center" style={canvasCell}>
								<table
									cellPadding={0}
									cellSpacing={0}
									role="presentation"
									style={card}
									width={600}
								>
									<tbody>
										<tr>
											<td style={pad("32px 32px 0")}>
												<Logo />
											</td>
										</tr>
										<tr>
											<td style={pad("28px 32px 0")}>
												<div style={headingStyle}>{heading}</div>
												<div style={bodyStyle}>{body}</div>
											</td>
										</tr>
										<tr>
											<td style={pad("28px 32px 0")}>
												<ActionButton href={url}>{buttonLabel}</ActionButton>
											</td>
										</tr>
										<tr>
											<td style={pad("28px 32px 0")}>
												<div style={mutedStyle}>
													This link expires in {expiresInMinutes} minutes. If
													the button does not work, copy this address into your
													browser:
												</div>
												<div style={urlWrap}>
													<Link href={url} style={urlLink}>
														{url}
													</Link>
												</div>
											</td>
										</tr>
										<tr>
											<td style={pad("28px 32px 0")}>
												<table
													cellPadding={0}
													cellSpacing={0}
													role="presentation"
													style={noBorder}
													width="100%"
												>
													<tbody>
														<tr>
															<td style={rule}>&nbsp;</td>
														</tr>
													</tbody>
												</table>
											</td>
										</tr>
										<tr>
											<td style={pad("20px 32px 32px")}>
												<div style={footnoteStyle}>
													You are receiving this because someone entered this
													address on Mezo. If that was not you, ignore this
													email and no action will be taken.
												</div>
											</td>
										</tr>
									</tbody>
								</table>
							</td>
						</tr>
					</tbody>
				</table>
			</Body>
		</Html>
	);
}

/**
 * The bar mark plus wordmark, built from table cells with background colours
 * rather than an SVG or a hosted PNG: nothing to unblock, no asset URL to keep
 * alive, and it renders identically everywhere.
 */
function Logo() {
	const bars = [
		{ height: 12, key: "a" },
		{ height: 20, key: "b" },
		{ height: 8, key: "c" },
		{ height: 16, key: "d" },
	];

	return (
		<table cellPadding={0} cellSpacing={0} role="presentation" style={noBorder}>
			<tbody>
				<tr>
					{bars.map((bar) => (
						<td key={bar.key} style={barCell} valign="bottom">
							<table
								cellPadding={0}
								cellSpacing={0}
								role="presentation"
								style={noBorder}
							>
								<tbody>
									<tr>
										<td
											height={bar.height}
											style={{ ...bar_, height: `${bar.height}px` }}
											width={5}
										>
											&nbsp;
										</td>
									</tr>
								</tbody>
							</table>
						</td>
					))}
					<td style={wordmarkCell} valign="bottom">
						<span style={wordmark}>mezo</span>
					</td>
				</tr>
			</tbody>
		</table>
	);
}

/** Bulletproof button: the fill is on a `<td>`, so it survives everywhere. */
function ActionButton({
	href,
	children,
}: {
	href: string;
	children: React.ReactNode;
}) {
	return (
		<table cellPadding={0} cellSpacing={0} role="presentation" style={noBorder}>
			<tbody>
				<tr>
					<td align="center" style={buttonCell}>
						<Link href={href} style={buttonLink}>
							{children}
						</Link>
					</td>
				</tr>
			</tbody>
		</table>
	);
}

const INK = "#0A0A0B";
const INK_SECONDARY = "#666669";
const BORDER = "#E4E4E7";
const SURFACE = "#F4F4F5";

const FONT =
	"-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

const pad = (padding: string) => ({ padding });

const noBorder = { borderCollapse: "collapse" as const };

const canvas = { ...noBorder, backgroundColor: SURFACE };

const canvasCell = { padding: "40px 16px" };

const card = {
	...noBorder,
	backgroundColor: "#FFFFFF",
	border: `1px solid ${BORDER}`,
	borderRadius: "12px",
};

const barCell = { padding: "0 3px 0 0" };

const bar_ = {
	backgroundColor: INK,
	fontSize: "1px",
	lineHeight: "1px",
};

const wordmarkCell = { padding: "0 0 0 10px" };

const wordmark = {
	color: INK,
	fontFamily: FONT,
	fontSize: "22px",
	fontWeight: 600,
	letterSpacing: "-0.02em",
};

const headingStyle = {
	color: INK,
	fontFamily: FONT,
	fontSize: "22px",
	fontWeight: 600,
	letterSpacing: "-0.01em",
	lineHeight: "30px",
};

const bodyStyle = {
	color: INK_SECONDARY,
	fontFamily: FONT,
	fontSize: "15px",
	lineHeight: "24px",
	padding: "12px 0 0",
};

const buttonCell = {
	backgroundColor: INK,
	borderRadius: "8px",
	padding: "13px 26px",
};

const buttonLink = {
	color: "#FFFFFF",
	fontFamily: FONT,
	fontSize: "15px",
	fontWeight: 600,
	textDecoration: "none",
};

const mutedStyle = {
	color: INK_SECONDARY,
	fontFamily: FONT,
	fontSize: "13px",
	lineHeight: "20px",
};

const urlWrap = { padding: "8px 0 0" };

const urlLink = {
	color: INK_SECONDARY,
	fontFamily: FONT,
	fontSize: "13px",
};

const rule = {
	backgroundColor: BORDER,
	fontSize: "1px",
	height: "1px",
	lineHeight: "1px",
};

const footnoteStyle = {
	color: INK_SECONDARY,
	fontFamily: FONT,
	fontSize: "12px",
	lineHeight: "18px",
};

export default ActionEmail;
