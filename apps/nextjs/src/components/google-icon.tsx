// Google "G" mark, per the Google branding guidelines' minimum-asset SVG.
export function GoogleIcon(props: React.ComponentProps<"svg">) {
	return (
		<svg
			aria-hidden="true"
			focusable="false"
			viewBox="0 0 48 48"
			xmlns="http://www.w3.org/2000/svg"
			{...props}
		>
			<path
				d="M44.5 20H24v8.5h11.8C34.7 33.9 30.1 37 24 37c-7.2 0-13-5.8-13-13s5.8-13 13-13c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 4.1 29.6 2 24 2 11.8 2 2 11.8 2 24s9.8 22 22 22c11 0 21-8 21-22 0-1.3-.2-2.7-.5-4z"
				fill="#FFC107"
			/>
			<path
				d="M3.2 13.6l7 5.1C12.1 14.2 17.6 11 24 11c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 4.1 29.6 2 24 2 15.4 2 8 6.8 3.2 13.6z"
				fill="#FF3D00"
			/>
			<path
				d="M24 46c5.5 0 10.4-2 14.1-5.4l-6.5-5.5C29.5 36.5 26.9 37 24 37c-6.1 0-10.6-3.1-12.3-8.4l-7 5.4C9.4 41 16.1 46 24 46z"
				fill="#4CAF50"
			/>
			<path
				d="M44.5 20H24v8.5h11.8c-.8 2.3-2.3 4.3-4.2 5.6l6.5 5.5C41.9 36.9 45 31.2 45 24c0-1.3-.2-2.7-.5-4z"
				fill="#1976D2"
			/>
		</svg>
	);
}
