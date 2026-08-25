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
import { useMemo, useRef } from "react";
import { ProfileChangeToolUI } from "~/components/milo/profile-change-card";
import { RoutineToolUI } from "~/components/milo/routine-card";
import { Thread } from "~/components/milo/thread";
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
	threadId,
	initialMessages,
}: {
	threadId: string;
	initialMessages: UIMessage[];
}) {
	const router = useRouter();
	const utils = api.useUtils();
	// A thread that had no row before this turn is new to the sidebar, so the
	// list has to be re-read once. After that it is already there.
	const wasEmpty = useRef(initialMessages.length === 0);

	const transport = useMemo(
		() =>
			new AssistantChatTransport({ api: "/api/chat", body: { id: threadId } }),
		[threadId],
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

	return (
		<AssistantRuntimeProvider runtime={runtime}>
			<ProfileChangeToolUI />
			<RoutineToolUI />
			<MiloThread />
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
		title: "Build me an upper body session",
		label: "from what I have",
		prompt: "Create an upper body workout for me.",
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
