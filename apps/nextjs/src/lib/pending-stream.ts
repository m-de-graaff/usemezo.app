import type { ResumableClientStorage } from "@assistant-ui/ai-sdk";

export type PendingStream = ResumableClientStorage;

/**
 * The one run this conversation might be catching up on.
 *
 * The library ships a `sessionStorage` version of this. Ours holds the id in
 * memory instead, seeded from the server, because the thing being recovered
 * from is a browser that has no memory of the run at all.
 */
export function pendingStream(initial: string | null): PendingStream {
	let current = initial;
	const listeners = new Set<() => void>();

	return {
		getStreamId: () => current,
		setStreamId: (id) => {
			if (current === id) return;
			current = id;
			for (const listener of listeners) listener();
		},
		clear: () => {
			if (current === null) return;
			current = null;
			for (const listener of listeners) listener();
		},
		subscribe: (listener) => {
			listeners.add(listener);
			return () => listeners.delete(listener);
		},
	};
}
