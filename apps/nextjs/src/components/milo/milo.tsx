"use client";

import { AssistantChatTransport, useChatRuntime } from "@assistant-ui/ai-sdk";
import {
	AssistantRuntimeProvider,
	AuiConfig,
	AuiProvider,
	Suggestions,
	useAui,
} from "@assistant-ui/react";
import {
	lastAssistantMessageIsCompleteWithToolCalls,
	type UIMessage,
} from "ai";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useRef } from "react";
import { AskToolUI } from "~/components/milo/ask-card";
import {
	CreateExerciseToolUI,
	HideExerciseToolUI,
} from "~/components/milo/exercise-card";
import { ProfileChangeToolUI } from "~/components/milo/profile-change-card";
import { RememberToolUI } from "~/components/milo/remember-card";
import { RoutineToolUI } from "~/components/milo/routine-card";
import { StopRunProvider } from "~/components/milo/stop-run";
import { Thread } from "~/components/milo/thread";
import { type PendingStream, pendingStream } from "~/lib/pending-stream";
import { api } from "~/trpc/react";

/**
 * Milo's runtime.
 *
 * `sendAutomaticallyWhen` is what makes the confirm card work: a tool with no
 * server-side `execute` leaves the run waiting on a result, and this is the rule
 * that resumes it once the card has supplied one.
 *
 * The thread id travels in the transport's `body` rather than as the chat's own
 * id: assistant-ui mints its own ids for its runtime, and the one the route
 * saves under has to be the one in the URL.
 */
export function Milo({
	activeStreamId,
	threadId,
	initialMessages,
}: {
	/**
	 * The run this conversation was in the middle of when the page was built,
	 * if it was in the middle of one. Whatever the browser had in memory is
	 * gone by now, so the server is the only thing that still knows.
	 */
	activeStreamId: string | null;
	threadId: string;
	initialMessages: UIMessage[];
}) {
	const router = useRouter();
	const utils = api.useUtils();
	// A thread that had no row before this turn is new to the sidebar, so the
	// list has to be re-read once. After that it is already there.
	const wasEmpty = useRef(initialMessages.length === 0);

	/**
	 * Where the runtime looks for a run to reconnect to.
	 *
	 * Seeded from the thread row rather than from `sessionStorage`, which is
	 * what the library's own storage uses: a tab that was closed, or a phone
	 * picking up a conversation started on a laptop, has no session storage to
	 * read, and those are the cases this is for. Built once per mount so the
	 * id it was seeded with is answered for as long as this conversation is on
	 * screen.
	 */
	const storage = useRef<PendingStream>(undefined);
	storage.current ??= pendingStream(activeStreamId);
	const pending = storage.current;

	const transport = useMemo(
		() =>
			new AssistantChatTransport({
				api: "/api/chat",
				resumable: {
					storage: pending,
					resumeApi: (streamId) => `/api/chat/stream/${streamId}`,
				},
				// Not `body`: the transport writes its own `id` over whatever `body`
				// carried, and that id is a fresh one per mount. Saving under it means
				// a second row every time a conversation is reopened and continued.
				// This hook runs after, so it is the one place the URL's id survives.
				prepareSendMessagesRequest: ({
					body,
					messages,
					trigger,
					messageId,
				}) => ({
					body: { ...body, id: threadId, messages, trigger, messageId },
				}),
			}),
		[pending, threadId],
	);

	const runtime = useChatRuntime({
		messages: initialMessages,
		sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
		transport,
		onFinish: () => {
			if (!wasEmpty.current) return;
			wasEmpty.current = false;
			void utils.milo.list.invalidate();
			router.refresh();
		},
	});

	/**
	 * Stop for real, not just for this browser.
	 *
	 * Hanging up used to end the run because the run was the connection. Now it
	 * is a buffer on the server that outlives the tab on purpose, so a stop has
	 * to be sent to it, and the thread row has to be told the reply is over or
	 * the next visit would try to reconnect to a run nobody is producing.
	 */
	const stopRun = useCallback(() => {
		const streamId = pending.getStreamId();
		pending.clear();
		if (!streamId) return;
		void fetch(`/api/chat/stream/${streamId}`, { method: "DELETE" }).catch(
			// The screen has already stopped. A run left going is a wasted reply,
			// not a broken conversation.
			(error) => console.warn("[milo] could not stop the run", error),
		);
	}, [pending]);

	return (
		<AssistantRuntimeProvider runtime={runtime}>
			<StopRunProvider value={stopRun}>
				<AskToolUI />
				<CreateExerciseToolUI />
				<HideExerciseToolUI />
				<ProfileChangeToolUI />
				<RememberToolUI />
				<RoutineToolUI />
				<MiloThread />
			</StopRunProvider>
		</AssistantRuntimeProvider>
	);
}

/**
 * Openers worth a tap, every one of them something Milo can actually do with
 * the tools it has. A suggestion that leads somewhere it cannot go is worse
 * than no suggestion.
 */
const OPENERS = [
	{
		title: "What do my numbers say",
		label: "about where I am?",
		prompt:
			"Read my profile and tell me what my body composition numbers say about where I am right now.",
	},
	{
		title: "Log a new body fat reading",
		label: "from my scale",
		prompt: "My scale read 18.4% body fat this morning. Update my profile.",
	},
	{
		title: "Switch me to imperial",
		label: "for weights and heights",
		prompt: "Switch my units to imperial.",
	},
	{
		title: "Build me a training week",
		label: "around the days I have",
		prompt:
			"Build me a training week. Ask me whatever you need to know first, and tell me what weight to start each exercise at.",
	},
	{
		title: "Check my volume",
		label: "against what I should be doing",
		prompt:
			"Look at what I have actually been training and tell me which muscles are getting too few sets and which are getting too many.",
	},
];

function MiloThread() {
	const aui = useAui();
	const config = AuiConfig({ suggestions: Suggestions(OPENERS) });

	return (
		<AuiProvider config={config} extends={aui}>
			<Thread />
		</AuiProvider>
	);
}
