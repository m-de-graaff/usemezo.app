"use client";

import {
	ActionBarMorePrimitive,
	ActionBarPrimitive,
	type AssistantState,
	AuiIf,
	BranchPickerPrimitive,
	ComposerPrimitive,
	ErrorPrimitive,
	MessagePrimitive,
	SuggestionPrimitive,
	ThreadPrimitive,
	useAuiState,
} from "@assistant-ui/react";
import { Button } from "@mezo/ui/button";
import { cn } from "@mezo/ui/lib/utils";
import {
	ArrowDownIcon,
	ArrowUpIcon,
	CheckIcon,
	ChevronLeftIcon,
	ChevronRightIcon,
	CopyIcon,
	DownloadIcon,
	MoreHorizontalIcon,
	PencilIcon,
	RefreshCwIcon,
	SquareIcon,
} from "lucide-react";
import type { FC } from "react";
import { LogoThinking } from "~/components/logo-thinking";
import { MarkdownText } from "~/components/milo/markdown-text";
import { ToolFallback } from "~/components/milo/tool-fallback";
import { TooltipIconButton } from "~/components/milo/tooltip-icon-button";

/**
 * The chat itself, from assistant-ui's own thread component.
 *
 * Vendored rather than installed: the styling is the point of taking it, and a
 * copy is what makes it ours to fit against `@mezo/ui`. Attachments and voice
 * dictation are cut — Milo has nothing to do with a file yet, and the composer
 * reads better without two buttons that do nothing.
 *
 * Source: `.opensrc/assistant-ui/templates/minimal`.
 */

// Startup exposes a loading placeholder thread; treat it as a new chat so
// the composer mounts centered. Loads after startup keep the docked layout.
const isNewChatView = (s: AssistantState) =>
	s.thread.messages.length === 0 &&
	(!s.thread.isLoading || s.threads.isLoading);

// A switched thread that is still fetching its history: skeleton, not welcome.
const isHistoryLoadingView = (s: AssistantState) =>
	s.thread.messages.length === 0 &&
	s.thread.isLoading &&
	!s.thread.isDisabled &&
	!s.threads.isLoading;

const ThreadHistorySkeleton: FC = () => (
	<div
		className="fade-in flex animate-in flex-col fill-mode-both [animation-delay:150ms] [animation-duration:200ms]"
		role="status"
	>
		<span className="sr-only">Loading conversation</span>
		<div className="flex animate-pulse flex-col gap-y-6 motion-reduce:animate-none">
			<div className="ml-auto h-9 w-2/5 rounded-xl bg-muted" />
			<div className="flex flex-col gap-y-2">
				<div className="h-4 w-11/12 rounded-md bg-muted" />
				<div className="h-4 w-4/5 rounded-md bg-muted" />
				<div className="h-4 w-3/5 rounded-md bg-muted" />
			</div>
			<div className="ml-auto h-9 w-1/3 rounded-xl bg-muted" />
			<div className="flex flex-col gap-y-2">
				<div className="h-4 w-10/12 rounded-md bg-muted" />
				<div className="h-4 w-2/3 rounded-md bg-muted" />
			</div>
		</div>
	</div>
);

export const Thread: FC = () => {
	const isEmpty = useAuiState(isNewChatView);

	return (
		<ThreadPrimitive.Root
			className="@container flex h-full flex-col bg-background"
			style={{
				["--thread-max-width" as string]: "44rem",
				["--composer-bg" as string]: "var(--color-card)",
				["--composer-radius" as string]: "1.5rem",
				["--composer-padding" as string]: "8px",
			}}
		>
			{/* `scrollbar-gutter: stable` rather than a permanent `overflow-y-scroll`:
			    the space is reserved so the composer never shifts sideways when a
			    reply overflows, without painting an empty track down an empty chat. */}
			<ThreadPrimitive.Viewport
				className="relative flex flex-1 flex-col overflow-y-auto scroll-smooth [scrollbar-color:var(--color-border)_transparent] [scrollbar-gutter:stable] [scrollbar-width:thin]"
				turnAnchor="top"
			>
				<div
					className={cn(
						"mx-auto flex w-full max-w-(--thread-max-width) flex-1 flex-col px-4 pt-4",
						isEmpty && "justify-center",
					)}
				>
					<AuiIf condition={isNewChatView}>
						<ThreadWelcome />
					</AuiIf>
					<AuiIf condition={isHistoryLoadingView}>
						<ThreadHistorySkeleton />
					</AuiIf>

					{/* A log, so replies are announced as they arrive. Each message
					    marks itself `aria-busy` while it streams, which is what keeps
					    that from being one announcement per token. `scroll-mb-32`
					    leaves room for the sticky composer when focus moves into a
					    message near the bottom (WCAG 2.4.11). */}
					<div
						aria-label="Conversation with Milo"
						className="mb-14 flex scroll-mb-32 flex-col gap-y-6 empty:hidden"
						role="log"
					>
						<ThreadPrimitive.Messages>
							{() => <ThreadMessage />}
						</ThreadPrimitive.Messages>
					</div>

					<ThreadPrimitive.ViewportFooter
						className={cn(
							"flex flex-col gap-4 overflow-visible bg-background pb-4 md:pb-6",
							!isEmpty &&
								"sticky bottom-0 mt-auto rounded-t-(--composer-radius)",
						)}
					>
						<ThreadScrollToBottom />
						<Composer />
						<AuiIf condition={(s) => isNewChatView(s) && s.composer.isEmpty}>
							<ThreadSuggestions />
						</AuiIf>
					</ThreadPrimitive.ViewportFooter>
				</div>
			</ThreadPrimitive.Viewport>
		</ThreadPrimitive.Root>
	);
};

const ThreadMessage: FC = () => {
	const role = useAuiState((s) => s.message.role);
	const isEditing = useAuiState((s) => s.message.composer.isEditing);

	if (isEditing) return <EditComposer />;
	if (role === "user") return <UserMessage />;
	return <AssistantMessage />;
};

const ThreadScrollToBottom: FC = () => (
	<ThreadPrimitive.ScrollToBottom asChild>
		<TooltipIconButton
			className="absolute -top-12 z-10 self-center rounded-full p-4 disabled:invisible dark:border-border dark:bg-background dark:hover:bg-accent"
			tooltip="Scroll to bottom"
			variant="outline"
		>
			<ArrowDownIcon />
		</TooltipIconButton>
	</ThreadPrimitive.ScrollToBottom>
);

const ThreadWelcome: FC = () => (
	<div className="mb-6 flex flex-col items-center px-4 text-center">
		<h1 className="fade-in slide-in-from-bottom-1 animate-in fill-mode-both font-medium text-2xl tracking-tight duration-200">
			What can I help with?
		</h1>
		<p className="mt-2 max-w-sm text-pretty text-muted-foreground text-sm leading-relaxed">
			Ask about your training, food or sleep. Milo can read your saved numbers
			and suggest changes, but nothing is written until you say so.
		</p>
	</div>
);

const ThreadSuggestions: FC = () => (
	<div className="flex w-full flex-wrap items-center justify-center gap-2 px-4">
		<ThreadPrimitive.Suggestions>
			{() => <ThreadSuggestionItem />}
		</ThreadPrimitive.Suggestions>
	</div>
);

const ThreadSuggestionItem: FC = () => (
	<div className="fade-in slide-in-from-bottom-2 animate-in fill-mode-both duration-200">
		<SuggestionPrimitive.Trigger asChild send>
			<Button
				className="h-auto gap-1.5 whitespace-nowrap rounded-full border border-border/60 px-3.5 py-1.5 font-normal text-foreground text-sm transition-colors hover:bg-muted"
				variant="ghost"
			>
				<SuggestionPrimitive.Title />
				<SuggestionPrimitive.Description className="empty:hidden" />
			</Button>
		</SuggestionPrimitive.Trigger>
	</div>
);

const Composer: FC = () => (
	<ComposerPrimitive.Root className="relative flex w-full flex-col">
		<div className="flex w-full cursor-text flex-col gap-2 rounded-(--composer-radius) border border-border/60 bg-(--composer-bg) p-(--composer-padding) transition-[border-color] focus-within:border-border dark:border-muted-foreground/15 dark:focus-within:border-muted-foreground/30">
			<ComposerPrimitive.Input
				aria-label="Message Milo"
				autoFocus
				className="max-h-48 min-h-10 w-full resize-none bg-transparent px-2.5 py-1 text-base leading-6 outline-none placeholder:text-muted-foreground/60"
				placeholder="Ask Milo anything…"
				rows={1}
			/>
			<ComposerAction />
		</div>
	</ComposerPrimitive.Root>
);

const ComposerAction: FC = () => (
	<div className="relative flex items-center justify-end">
		<AuiIf condition={(s) => !s.thread.isRunning}>
			<ComposerPrimitive.Send asChild>
				<TooltipIconButton
					aria-label="Send message"
					className="size-7 rounded-full"
					side="bottom"
					tooltip="Send message"
					type="button"
					variant="default"
				>
					<ArrowUpIcon className="size-4" />
				</TooltipIconButton>
			</ComposerPrimitive.Send>
		</AuiIf>
		<AuiIf condition={(s) => s.thread.isRunning}>
			<ComposerPrimitive.Cancel asChild>
				<Button
					aria-label="Stop generating"
					className="size-7 rounded-full"
					size="icon"
					type="button"
					variant="default"
				>
					<SquareIcon className="size-3.5 fill-current" />
				</Button>
			</ComposerPrimitive.Cancel>
		</AuiIf>
	</div>
);

const MessageError: FC = () => (
	<MessagePrimitive.Error>
		<ErrorPrimitive.Root
			className="mt-2 rounded-md border border-destructive bg-destructive/10 p-3 text-destructive text-sm dark:bg-destructive/5 dark:text-red-200"
			role="alert"
		>
			<ErrorPrimitive.Message className="line-clamp-2" />
		</ErrorPrimitive.Root>
	</MessagePrimitive.Error>
);

const AssistantMessage: FC = () => {
	// Busy while the reply streams, so the surrounding log announces the finished
	// message once rather than stuttering through it token by token.
	const isRunning = useAuiState((s) => s.message.status?.type === "running");

	return (
		<MessagePrimitive.Root
			aria-busy={isRunning}
			className="fade-in slide-in-from-bottom-1 relative -mb-7.5 animate-in pb-7.5 duration-150 [contain-intrinsic-size:auto_200px] [content-visibility:auto]"
			data-role="assistant"
		>
			<div className="wrap-break-word px-2 text-foreground leading-relaxed">
				<MessagePrimitive.Parts>
					{({ part }) => {
						if (part.type === "text") return <MarkdownText />;
						if (part.type === "tool-call")
							return part.toolUI ?? <ToolFallback {...part} />;
						return null;
					}}
				</MessagePrimitive.Parts>
				<AuiIf
					condition={(s) =>
						s.message.status?.type === "running" && s.message.parts.length === 0
					}
				>
					<span className="inline-flex" role="status">
						<span className="sr-only">Milo is thinking</span>
						<LogoThinking className="size-5" />
					</span>
				</AuiIf>
				<MessageError />
			</div>

			<div className="ms-2 flex min-h-7.5 items-center pt-1.5">
				<BranchPicker />
				<AssistantActionBar />
			</div>
		</MessagePrimitive.Root>
	);
};

const AssistantActionBar: FC = () => (
	<ActionBarPrimitive.Root
		autohide="not-last"
		className="fade-in col-start-3 row-start-2 -ms-1 flex animate-in gap-1 text-muted-foreground duration-200"
		hideWhenRunning
	>
		<ActionBarPrimitive.Copy asChild>
			<TooltipIconButton tooltip="Copy">
				<AuiIf condition={(s) => s.message.isCopied}>
					<CheckIcon className="fade-in zoom-in-50 animate-in duration-200 ease-out" />
				</AuiIf>
				<AuiIf condition={(s) => !s.message.isCopied}>
					<CopyIcon className="fade-in zoom-in-75 animate-in duration-150" />
				</AuiIf>
			</TooltipIconButton>
		</ActionBarPrimitive.Copy>
		<ActionBarPrimitive.Reload asChild>
			<TooltipIconButton tooltip="Try again">
				<RefreshCwIcon />
			</TooltipIconButton>
		</ActionBarPrimitive.Reload>
		<ActionBarMorePrimitive.Root>
			<ActionBarMorePrimitive.Trigger asChild>
				<TooltipIconButton
					className="data-[state=open]:bg-accent"
					tooltip="More"
				>
					<MoreHorizontalIcon />
				</TooltipIconButton>
			</ActionBarMorePrimitive.Trigger>
			<ActionBarMorePrimitive.Content
				align="start"
				className="data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[side=bottom]:slide-in-from-top-2 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 z-50 min-w-[8rem] animate-in overflow-hidden rounded-xl border bg-popover/95 p-1.5 text-popover-foreground shadow-lg backdrop-blur-sm data-[state=closed]:animate-out"
				side="bottom"
				sideOffset={6}
			>
				<ActionBarPrimitive.ExportMarkdown asChild>
					<ActionBarMorePrimitive.Item className="flex cursor-pointer select-none items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground">
						<DownloadIcon className="size-4" />
						Export as Markdown
					</ActionBarMorePrimitive.Item>
				</ActionBarPrimitive.ExportMarkdown>
			</ActionBarMorePrimitive.Content>
		</ActionBarMorePrimitive.Root>
	</ActionBarPrimitive.Root>
);

const UserMessage: FC = () => (
	<MessagePrimitive.Root
		className="fade-in slide-in-from-bottom-1 grid animate-in auto-rows-auto grid-cols-[minmax(72px,1fr)_auto] content-start gap-y-2 px-2 duration-150 [contain-intrinsic-size:auto_200px] [content-visibility:auto] [&:where(>*)]:col-start-2"
		data-role="user"
	>
		<div className="relative col-start-2 min-w-0">
			<div className="peer wrap-break-word rounded-xl bg-muted px-4 py-2 text-foreground empty:hidden">
				<MessagePrimitive.Parts />
			</div>
			<div className="absolute start-0 top-1/2 -translate-x-full -translate-y-1/2 pe-2 peer-empty:hidden rtl:translate-x-full">
				<UserActionBar />
			</div>
		</div>

		<BranchPicker className="col-span-full col-start-1 row-start-3 -me-1 justify-end" />
	</MessagePrimitive.Root>
);

const UserActionBar: FC = () => (
	<ActionBarPrimitive.Root
		autohide="not-last"
		className="flex flex-col items-end"
		hideWhenRunning
	>
		<ActionBarPrimitive.Edit asChild>
			<TooltipIconButton tooltip="Edit">
				<PencilIcon />
			</TooltipIconButton>
		</ActionBarPrimitive.Edit>
	</ActionBarPrimitive.Root>
);

const EditComposer: FC = () => (
	<MessagePrimitive.Root className="flex flex-col px-2 [contain-intrinsic-size:auto_200px] [content-visibility:auto]">
		<ComposerPrimitive.Root className="ms-auto flex w-full max-w-[85%] cursor-text flex-col rounded-(--composer-radius) border border-border/60 bg-(--composer-bg) shadow-[0_4px_16px_-8px_rgba(0,0,0,0.08),0_1px_2px_rgba(0,0,0,0.04)] dark:border-muted-foreground/15 dark:shadow-none">
			<ComposerPrimitive.Input
				autoFocus
				className="min-h-14 w-full resize-none bg-transparent px-4 pt-3 pb-1 text-base text-foreground outline-none"
			/>
			<div className="mx-2.5 mb-2.5 flex items-center gap-1.5 self-end">
				<ComposerPrimitive.Cancel asChild>
					<Button className="h-8 rounded-full px-3.5" size="sm" variant="ghost">
						Cancel
					</Button>
				</ComposerPrimitive.Cancel>
				<ComposerPrimitive.Send asChild>
					<Button className="h-8 rounded-full px-3.5" size="sm">
						Update
					</Button>
				</ComposerPrimitive.Send>
			</div>
		</ComposerPrimitive.Root>
	</MessagePrimitive.Root>
);

const BranchPicker: FC<BranchPickerPrimitive.Root.Props> = ({
	className,
	...rest
}) => (
	<BranchPickerPrimitive.Root
		className={cn(
			"-ms-2 me-2 inline-flex items-center text-muted-foreground text-xs",
			className,
		)}
		hideWhenSingleBranch
		{...rest}
	>
		<BranchPickerPrimitive.Previous asChild>
			<TooltipIconButton tooltip="Previous">
				<ChevronLeftIcon />
			</TooltipIconButton>
		</BranchPickerPrimitive.Previous>
		<span className="font-medium">
			<BranchPickerPrimitive.Number /> / <BranchPickerPrimitive.Count />
		</span>
		<BranchPickerPrimitive.Next asChild>
			<TooltipIconButton tooltip="Next">
				<ChevronRightIcon />
			</TooltipIconButton>
		</BranchPickerPrimitive.Next>
	</BranchPickerPrimitive.Root>
);
