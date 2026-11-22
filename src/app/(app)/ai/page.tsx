"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { WalloraMonogram } from "@/components/brand/wallora-logo";
import { useVerificationGate } from "@/components/verification/verification-gate";
import { useDiscovery } from "@/stores/discovery";
import {
  SendIcon,
  PlusIcon,
  ChatIcon,
  SparklesIcon,
  TrashIcon,
  SearchIcon,
  WandIcon,
  ArrowRightIcon,
  CodeIcon,
} from "@/components/icons/wallora-icons";
import { cn } from "@/lib/utils";

type Mode = {
  id: string;
  name: string;
  shortName: string;
  description: string;
  starterPrompts: string[];
};

type Conversation = {
  id: string;
  title: string;
  mode: string;
  messageCount: number;
  lastMessageAt: string;
  createdAt: string;
};

type Message = {
  id: string;
  role: string;
  content: string;
  createdAt: string;
};

type Suggestion = {
  action: string;
  params: string;
  label: string;
};

const THINKING_STAGES = [
  "Understanding your request",
  "Thinking",
  "Writing the response",
  "Almost there",
];

function parseSuggestions(content: string): { text: string; suggestions: Suggestion[] } {
  const regex = /\[SUGGEST:(\w+):([^\]]+)\]/g;
  const suggestions: Suggestion[] = [];
  let match;
  while ((match = regex.exec(content)) !== null) {
    const action = match[1];
    const params = match[2].trim();
    let label = params;
    if (action === "search_wallpapers") label = `Search: ${params}`;
    else if (action === "enhance_prompt") label = "Enhance this prompt";
    else if (action === "create_project") label = `Create project: ${params}`;
    else if (action === "open_builder") label = "Open website builder";
    suggestions.push({ action, params, label });
  }
  return { text: content.replace(regex, "").trim(), suggestions };
}

export default function AiChatPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const setDiscoveryQuery = useDiscovery((s) => s.setQuery);

  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [mode, setMode] = React.useState("creative-assistant");
  const [input, setInput] = React.useState("");
  const [sendingTo, setSendingTo] = React.useState<string | null>(null);
  const [stage, setStage] = React.useState(0);
  const abortRef = React.useRef<AbortController | null>(null);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);
  const messagesContainerRef = React.useRef<HTMLDivElement>(null);

  const { data: modesData } = useQuery<{ data: Mode[] }>({
    queryKey: ["ai-modes"],
    queryFn: async () => {
      const res = await fetch("/api/v1/ai/modes");
      return res.json();
    },
  });
  const modes = modesData?.data ?? [];

  const { data: conversationsData } = useQuery<{ data: Conversation[] }>({
    queryKey: ["ai-conversations"],
    queryFn: async () => {
      const res = await fetch("/api/v1/ai/conversations");
      if (!res.ok) return { data: [] };
      return res.json();
    },
  });
  const conversations = conversationsData?.data ?? [];

  const { data: activeData } = useQuery<{
    data: { id: string; title: string; mode: string; messages: Message[] };
  }>({
    queryKey: ["ai-conversation", activeId],
    queryFn: async () => {
      const res = await fetch(`/api/v1/ai/conversations/${activeId}`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!activeId,
  });

  const messages = activeData?.data.messages ?? [];
  const activeMode = modes.find((m) => m.id === (activeData?.data.mode ?? mode));
  const isThinkingHere = !!sendingTo && sendingTo === activeId;

  // Cycle progress stages while a request is in flight, so the user can see
  // that work is happening instead of a frozen spinner.
  React.useEffect(() => {
    if (!sendingTo) {
      setStage(0);
      return;
    }
    setStage(0);
    const id = window.setInterval(() => setStage((s) => (s + 1) % THINKING_STAGES.length), 1900);
    return () => window.clearInterval(id);
  }, [sendingTo]);

  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isThinkingHere]);

  // Abort any in-flight send when leaving the page.
  React.useEffect(() => () => abortRef.current?.abort(), []);

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/v1/ai/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: (data) => {
      setActiveId(data.data.id);
      queryClient.invalidateQueries({ queryKey: ["ai-conversations"] });
    },
    onError: () => toast.error("Could not start a conversation. Please try again."),
  });

  const isBusy = createMutation.isPending || !!sendingTo;
  const { guard } = useVerificationGate();

  const sendMutation = useMutation({
    mutationFn: async ({ content, convId }: { content: string; convId: string }) => {
      const controller = new AbortController();
      abortRef.current = controller;
      const timeout = window.setTimeout(() => controller.abort(), 90000);
      try {
        const res = await fetch(`/api/v1/ai/conversations/${convId}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content }),
          signal: controller.signal,
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err?.error?.message ?? "Failed");
        }
        return res.json();
      } catch (err) {
        if (controller.signal.aborted) {
          throw new Error("That request took too long. Please try again.");
        }
        throw err;
      } finally {
        window.clearTimeout(timeout);
        if (abortRef.current === controller) abortRef.current = null;
      }
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["ai-conversation", vars.convId] });
      queryClient.invalidateQueries({ queryKey: ["ai-conversations"] });
    },
    onError: (err: Error) => toast.error(err.message),
    // Always clear the scoped pending flag — success, error, HTTP error or
    // timeout. This is the fix for the animation getting stuck forever.
    onSettled: () => setSendingTo(null),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/v1/ai/conversations/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: (_d, deletedId) => {
      if (activeId === deletedId) setActiveId(null);
      queryClient.invalidateQueries({ queryKey: ["ai-conversations"] });
      toast.success("Conversation deleted");
    },
  });

  const cancelPending = React.useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setSendingTo(null);
  }, []);

  const startNew = () => {
    cancelPending();
    setActiveId(null);
  };

  const switchConversation = (id: string) => {
    // Keep the request alive but don't paint its thinking bubble onto the
    // newly selected thread — the bubble is scoped to sendingTo.
    setActiveId(id);
  };

  const handleSend = async () => {
    const content = input.trim();
    if (!content || isBusy) return;
    guard(async () => {
      setInput("");
      try {
        let convId: string;
        if (activeId) {
          convId = activeId;
        } else {
          const created = await createMutation.mutateAsync();
          convId = String(created.data.id);
        }
        setSendingTo(convId);
        sendMutation.mutate({ content, convId });
      } catch {
        setInput(content);
      }
    }, { action: "chat with WALLORA AI" });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSuggestion = (s: Suggestion) => {
    if (s.action === "search_wallpapers") {
      setDiscoveryQuery(s.params);
      router.push("/discover");
    } else if (s.action === "enhance_prompt") {
      setInput(s.params);
    } else if (s.action === "create_project") {
      router.push("/projects");
    } else if (s.action === "open_builder") {
      router.push("/builder");
    }
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
      {/* Sidebar */}
      <aside className="hidden w-72 shrink-0 flex-col border-r border-border bg-surface/40 md:flex">
        <div className="flex items-center justify-between border-b border-border bg-surface px-4 py-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-secondary-text">
            Conversations
          </span>
          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={startNew}>
            <PlusIcon size={14} /> New
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {conversations.length === 0 ? (
            <div className="px-3 py-8 text-center text-xs text-secondary-text">
              No conversations yet.
              <br />
              Start chatting to begin.
            </div>
          ) : (
            conversations.map((c) => (
              <div
                key={c.id}
                className={cn(
                  "group mb-1 flex items-center gap-2 rounded-lg px-3 py-2.5 cursor-pointer transition-colors",
                  activeId === c.id
                    ? "bg-raised text-foreground"
                    : "text-secondary-text hover:bg-surface hover:text-foreground",
                )}
                onClick={() => switchConversation(c.id)}
              >
                <ChatIcon size={14} />
                <span className="flex-1 truncate text-xs">{c.title}</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteMutation.mutate(c.id);
                  }}
                  className="opacity-0 transition-opacity group-hover:opacity-100 text-destructive"
                  aria-label="Delete"
                >
                  <TrashIcon size={12} />
                </button>
              </div>
            ))
          )}
        </div>
        <div className="border-t border-border p-2">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-xs"
            onClick={() => router.push("/builder")}
          >
            <CodeIcon size={14} /> Website Builder
          </Button>
        </div>
      </aside>

      {/* Chat area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header bar */}
        <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
          <div className="flex items-center gap-2">
            <WalloraMonogram className="h-7 w-7" />
            <div>
              <span className="font-display text-sm font-semibold text-foreground">
                WALLORA AI
              </span>
              <span className="ml-2 text-xs text-secondary-text">
                {activeMode?.name ?? "Creative Assistant"}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs md:hidden"
              onClick={() => router.push("/builder")}
            >
              <CodeIcon size={13} /> Builder
            </Button>
            <Select
              value={activeData?.data.mode ?? mode}
              onValueChange={(v) => {
                setMode(v);
                if (activeId) {
                  fetch(`/api/v1/ai/conversations/${activeId}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ mode: v }),
                  });
                }
              }}
            >
              <SelectTrigger className="h-8 w-[140px] border-border bg-surface text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-border bg-popover">
                {modes.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.shortName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Messages — stable scrollable area */}
        <div ref={messagesContainerRef} className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-2xl px-4 py-6">
            {messages.length === 0 && !isThinkingHere ? (
              <EmptyState mode={activeMode} onStarterClick={setInput} />
            ) : (
              <div className="flex flex-col gap-5">
                {messages.map((msg) => (
                  <MessageBubble key={msg.id} message={msg} onSuggestion={handleSuggestion} />
                ))}
                {isThinkingHere && (
                  <ThinkingBubble stage={stage} />
                )}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>
        </div>

        {/* Composer — stable bottom bar */}
        <div className="border-t border-border bg-surface/60 px-4 py-3">
          <div className="mx-auto max-w-2xl">
            <div className="relative flex items-end gap-2 rounded-xl border border-border bg-raised p-2 focus-within:border-primary/40">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask WALLORA AI anything…"
                rows={1}
                className="min-h-[40px] max-h-[120px] flex-1 resize-none border-0 bg-transparent px-2 py-1.5 text-sm focus-visible:ring-0"
                disabled={isBusy}
              />
              <Button
                size="icon"
                className="h-9 w-9 shrink-0 bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={handleSend}
                disabled={!input.trim() || isBusy}
                aria-label="Send"
              >
                {isBusy ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <SendIcon size={16} />
                )}
              </Button>
            </div>
            <p className="mt-1.5 px-2 text-[11px] text-secondary-text">
              Enter to send · Shift+Enter for newline
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function ThinkingBubble({ stage }: { stage: number }) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
        <SparklesIcon size={16} />
      </span>
      <div className="rounded-2xl rounded-tl-sm border border-border bg-surface px-4 py-3">
        <div className="flex items-center gap-2">
          <Loader2 className="size-4 animate-spin text-primary" />
          <span className="text-sm text-secondary-text">{THINKING_STAGES[stage]}…</span>
        </div>
        <div className="mt-2 flex gap-1">
          {THINKING_STAGES.map((_, i) => (
            <span
              key={i}
              className={cn(
                "h-1 w-8 rounded-full transition-colors duration-300",
                i <= stage ? "bg-primary" : "bg-raised",
              )}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function MessageBubble({
  message,
  onSuggestion,
}: {
  message: Message;
  onSuggestion: (s: Suggestion) => void;
}) {
  const isUser = message.role === "user";
  const { text, suggestions } = parseSuggestions(message.content);

  return (
    <div className={cn("flex items-start gap-3", isUser && "flex-row-reverse")}>
      <span
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
          isUser ? "bg-raised text-foreground" : "bg-primary/15 text-primary",
        )}
      >
        {isUser ? (
          <span className="text-[10px] font-semibold">You</span>
        ) : (
          <SparklesIcon size={16} />
        )}
      </span>
      <div
        className={cn(
          "max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
          isUser
            ? "rounded-tr-sm bg-primary/10 text-foreground"
            : "rounded-tl-sm border border-border bg-surface text-foreground",
        )}
      >
        <p className="whitespace-pre-wrap">{text}</p>
        {suggestions.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {suggestions.map((s, i) => (
              <button
                key={i}
                type="button"
                onClick={() => onSuggestion(s)}
                className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/20"
              >
                {s.action === "search_wallpapers" && <SearchIcon size={12} />}
                {s.action === "enhance_prompt" && <WandIcon size={12} />}
                {s.action === "create_project" && <PlusIcon size={12} />}
                {s.action === "open_builder" && <CodeIcon size={12} />}
                {s.label}
                <ArrowRightIcon size={12} />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyState({
  mode,
  onStarterClick,
}: {
  mode?: Mode;
  onStarterClick: (p: string) => void;
}) {
  return (
    <div className="flex flex-col items-center gap-6 py-12 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <SparklesIcon size={32} />
      </span>
      <div>
        <h1 className="font-display text-xl font-semibold text-foreground">
          {mode?.name ?? "Creative Assistant"}
        </h1>
        <p className="mt-2 max-w-md text-sm text-secondary-text">
          {mode?.description ?? "Your AI creative collaborator."}
        </p>
      </div>
      {mode && mode.starterPrompts.length > 0 && (
        <div className="flex flex-col gap-2 w-full max-w-md">
          {mode.starterPrompts.map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => onStarterClick(prompt)}
              className="rounded-xl border border-border bg-surface px-4 py-3 text-left text-sm text-secondary-text transition-colors hover:border-primary/30 hover:text-foreground"
            >
              {prompt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
