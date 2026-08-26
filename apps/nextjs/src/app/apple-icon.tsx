import { ImageResponse } from "next/og";
import { BARS } from "~/components/logo";

// iOS masks this into its own rounded square and never honours transparency,
// so unlike icon.svg it is opaque and dark in both colour schemes.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// The mark is drawn in a 24-unit box; this fills 108px of the 180px tile.
const SCALE = 5.625;

export default function AppleIcon() {
	return new ImageResponse(
		<div
			style={{
				width: "100%",
				height: "100%",
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				background: "#0a0a0a",
			}}
		>
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
		</div>,
		size,
	);
}
