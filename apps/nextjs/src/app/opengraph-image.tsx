import { ImageResponse } from "next/og";
import { BARS } from "~/components/logo";

export const alt = "Mezo: training, nutrition and sleep in one app";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// The mark is drawn in a 24-unit box; this renders it at 96px tall.
const SCALE = 6;

export default function OpengraphImage() {
	return new ImageResponse(
		<div
			style={{
				width: "100%",
				height: "100%",
				display: "flex",
				flexDirection: "column",
				justifyContent: "center",
				gap: 32,
				padding: 96,
				background: "#0a0a0a",
				color: "#fafafa",
			}}
		>
			<div style={{ display: "flex", alignItems: "flex-end", gap: 24 }}>
				<div
					style={{ display: "flex", alignItems: "flex-end", gap: 1.6 * SCALE }}
				>
					{BARS.map((bar) => (
						<div
							key={bar.x}
							style={{
								width: 3.6 * SCALE,
								height: bar.height * SCALE,
								borderRadius: SCALE,
								background: "#fafafa",
							}}
						/>
					))}
				</div>
				<div style={{ fontSize: 64, letterSpacing: -2, lineHeight: 1 }}>
					mezo
				</div>
			</div>
			<div style={{ fontSize: 76, letterSpacing: -2, lineHeight: 1.1 }}>
				Training, nutrition and sleep in one app.
			</div>
			<div style={{ fontSize: 36, color: "#a1a1a1", lineHeight: 1.3 }}>
				See what is actually moving the needle.
			</div>
		</div>,
		size,
	);
}
