"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import {
  X,
  Send,
  Plus,
  MessageSquare,
  Loader2,
  Sparkles,
  Trash2,
  ArrowRight,
  Search,
  Wand2,
  FolderPlus,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { WalloraMonogram } from "@/components/brand/wallora-logo";
import { useAiChat } from "@/stores/ai-chat";
import { useDiscovery } from "@/stores/discovery";
import { cn } from "@/lib/utils";

type Mode = {
  id: string;
  name: string;
  shortName: string;
  description: string;
  icon: string;
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

function parseSuggestions(content: string): { text: string; suggestions: Suggestion[] } {
  const regex = /\[SUGGEST:(\w+):([^\]]+)\]/g;
  const suggestions: Suggestion[] = [];
  let text = content;
  let match;

  while ((match = regex.exec(content)) !== null) {
    const action = match[1];
    const params = match[2].trim();
    let label = params;
    if (action === "search_wallpapers") label = `Search: ${params}`;
    else if (action === "enhance_prompt") label = "Enhance this prompt";
    else if (action === "create_project") label = `Create project: ${params}`;
    suggestions.push({ action, params, label });
  }

  text = content.replace(regex, "").trim();
  return { text, suggestions };
}

export function AiChatPanel() {
  const { open, conversationId, mode, closeChat, setConversationId, setMode } = useAiChat();
  const setDiscoveryQuery = useDiscovery((s) => s.setQuery);
  const setDiscoveryCategory = useDiscovery((s) => s.setCategory);
  const queryClient = useQueryClient();

  const [input, setInput] = React.useState("");
  const [isCreating, setIsCreating] = React.useState(false);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  // Fetch modes
  const { data: modesData } = useQuery<{ data: Mode[] }>({
    queryKey: ["ai-modes"],
    queryFn: async () => {
      const res = await fetch("/api/v1/ai/modes");
      return res.json();
    },
  });
  const modes = modesData?.data ?? [];

  // Fetch conversations list
  const { data: conversationsData } = useQuery<{ data: Conversation[] }>({
    queryKey: ["ai-conversations"],
    queryFn: async () => {
      const res = await fetch("/api/v1/ai/conversations");
      if (!res.ok) return { data: [] };
      return res.json();
    },
    enabled: open,
  });
  const conversations = conversationsData?.data ?? [];

  // Fetch active conversation messages
  const { data: activeConversation, isLoading: isLoadingMessages } = useQuery<{
    data: { id: string; title: string; mode: string; messages: Message[] };
  }>({
    queryKey: ["ai-conversation", conversationId],
    queryFn: async () => {
      const res = await fetch(`/api/v1/ai/conversations/${conversationId}`);
      if (!res.ok) throw new Error("Failed to load conversation");
      return res.json();
    },
    enabled: open && !!conversationId,
  });

  const messages = activeConversation?.data.messages ?? [];

  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Create conversation
  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/v1/ai/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      });
      if (!res.ok) throw new Error("Failed to create conversation");
      return res.json();
    },
    onSuccess: (data) => {
      setConversationId(data.data.id);
      queryClient.invalidateQueries({ queryKey: ["ai-conversations"] });
    },
  });

  // Send message
  const sendMutation = useMutation({
    mutationFn: async ({ content, convId }: { content: string; convId: string }) => {
      const res = await fetch(`/api/v1/ai/conversations/${convId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error?.message ?? "Failed to send message");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-conversation", conversationId] });
      queryClient.invalidateQueries({ queryKey: ["ai-conversations"] });
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  // Delete conversation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/v1/ai/conversations/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      return res.json();
    },
    onSuccess: (_data, deletedId) => {
      if (conversationId === deletedId) setConversationId(null);
      queryClient.invalidateQueries({ queryKey: ["ai-conversations"] });
      toast.success("Conversation deleted");
    },
  });

  const handleSend = async () => {
    const content = input.trim();
    if (!content || sendMutation.isPending) return;

    setInput("");

    // If no active conversation, create one first
    let convId = conversationId;
    if (!convId) {
      setIsCreating(true);
      try {
        const created = await createMutation.mutateAsync();
        convId = created.data.id;
      } catch {
        setIsCreating(false);
        return;
      }
      setIsCreating(false);
    }

    sendMutation.mutate({ content, convId });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSuggestion = (suggestion: Suggestion) => {
    if (suggestion.action === "search_wallpapers") {
      closeChat();
      setDiscoveryQuery(suggestion.params);
      setTimeout(() => {
        document.getElementById("discover")?.scrollIntoView({ behavior: "smooth" });
      }, 300);
    } else if (suggestion.action === "enhance_prompt") {
      setInput(suggestion.params);
    } else if (suggestion.action === "create_project") {
      toast.info("Projects launch in Phase 7", {
        description: `Saved idea: ${suggestion.params}`,
      });
    }
  };

  const handleNewConversation = () => {
    setConversationId(null);
    setInput("");
  };

  const activeMode = modes.find((m) => m.id === (activeConversation?.data.mode ?? mode));

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[60] flex bg-background/95 backdrop-blur-sm"
        >
          {/* Sidebar (desktop) */}
          <aside className="hidden w-72 shrink-0 flex-col border-r border-border bg-surface/60 lg:flex">
            <div className="flex items-center justify-between border-b border-border p-4">
              <span className="text-xs font-semibold uppercase tracking-wider text-secondary-text">
                Conversations
              </span>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                onClick={handleNewConversation}
                aria-label="New conversation"
              >
                <Plus className="h-4 w-4" />
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
                      conversationId === c.id
                        ? "bg-raised text-foreground"
                        : "text-secondary-text hover:bg-surface hover:text-foreground",
                    )}
                    onClick={() => setConversationId(c.id)}
                  >
                    <MessageSquare className="h-3.5 w-3.5 shrink-0" />
                    <span className="flex-1 truncate text-xs">{c.title}</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteMutation.mutate(c.id);
                      }}
                      className="opacity-0 transition-opacity group-hover:opacity-100"
                      aria-label="Delete conversation"
                    >
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </aside>

          {/* Main chat area */}
          <div className="flex flex-1 flex-col">
            {/* Header */}
            <header className="flex items-center justify-between border-b border-border px-4 py-3">
              <div className="flex items-center gap-3">
                <WalloraMonogram className="h-8 w-8" />
                <div>
                  <h2 className="font-display text-sm font-semibold text-foreground">
                    WALLORA AI
                  </h2>
                  <p className="text-[11px] text-secondary-text">
                    {activeMode?.name ?? "Creative Assistant"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Select
                  value={activeConversation?.data.mode ?? mode}
                  onValueChange={(v) => {
                    setMode(v);
                    if (conversationId) {
                      fetch(`/api/v1/ai/conversations/${conversationId}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ mode: v }),
                      });
                    }
                  }}
                >
                  <SelectTrigger className="h-8 w-[150px] border-border bg-surface text-xs">
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
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  onClick={closeChat}
                  aria-label="Close AI chat"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </header>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-6">
              <div className="mx-auto max-w-2xl">
                {messages.length === 0 && !sendMutation.isPending ? (
                  <EmptyState
                    mode={activeMode}
                    starterPrompts={activeMode?.starterPrompts ?? []}
                    onStarterClick={(p) => setInput(p)}
                  />
                ) : (
                  <div className="flex flex-col gap-6">
                    {messages.map((msg) => (
                      <MessageBubble key={msg.id} message={msg} onSuggestion={handleSuggestion} />
                    ))}
                    {sendMutation.isPending && (
                      <div className="flex items-start gap-3">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                          <Sparkles className="h-4 w-4" />
                        </span>
                        <div className="flex items-center gap-2 rounded-2xl rounded-tl-sm border border-border bg-surface px-4 py-3">
                          <Loader2 className="h-4 w-4 animate-spin text-primary" />
                          <span className="text-sm text-secondary-text">Thinking…</span>
                        </div>
                      </div>
                    )}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </div>
            </div>

            {/* Composer */}
            <div className="border-t border-border bg-surface/40 px-4 py-3">
              <div className="mx-auto max-w-2xl">
                {sendMutation.isError && (
                  <p className="mb-2 text-xs text-destructive">
                    {sendMutation.error.message}
                  </p>
                )}
                <div className="relative flex items-end gap-2 rounded-2xl border border-border bg-surface p-2 focus-within:border-primary/40">
                  <Textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={`Ask WALLORA AI anything…`}
                    rows={1}
                    className="min-h-[40px] max-h-[120px] flex-1 resize-none border-0 bg-transparent px-2 py-1.5 text-sm focus-visible:ring-0"
                    disabled={sendMutation.isPending || isCreating}
                  />
                  <Button
                    size="icon"
                    className="h-9 w-9 shrink-0 bg-primary text-primary-foreground hover:bg-primary/90"
                    onClick={handleSend}
                    disabled={!input.trim() || sendMutation.isPending || isCreating}
                    aria-label="Send message"
                  >
                    {sendMutation.isPending || isCreating ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <p className="mt-1.5 px-2 text-[11px] text-secondary-text">
                  Press Enter to send · Shift+Enter for new line · WALLORA AI may suggest actions
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
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
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={cn("flex items-start gap-3", isUser && "flex-row-reverse")}
    >
      <span
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
          isUser
            ? "bg-raised text-foreground"
            : "bg-primary/15 text-primary",
        )}
      >
        {isUser ? (
          <span className="text-xs font-semibold">You</span>
        ) : (
          <Sparkles className="h-4 w-4" />
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
                {s.action === "search_wallpapers" && <Search className="h-3 w-3" />}
                {s.action === "enhance_prompt" && <Wand2 className="h-3 w-3" />}
                {s.action === "create_project" && <FolderPlus className="h-3 w-3" />}
                {s.label}
                <ArrowRight className="h-3 w-3" />
              </button>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

function EmptyState({
  mode,
  starterPrompts,
  onStarterClick,
}: {
  mode?: Mode;
  starterPrompts: string[];
  onStarterClick: (prompt: string) => void;
}) {
  return (
    <div className="flex flex-col items-center gap-6 py-12 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Sparkles className="h-8 w-8" />
      </span>
      <div>
        <h3 className="font-display text-xl font-semibold text-foreground">
          {mode?.name ?? "Creative Assistant"}
        </h3>
        <p className="mt-2 max-w-md text-sm text-secondary-text">
          {mode?.description ?? "Your AI creative collaborator. Ask anything, describe an idea, or pick a starter below."}
        </p>
      </div>
      {starterPrompts.length > 0 && (
        <div className="flex flex-col gap-2">
          {starterPrompts.map((prompt) => (
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
      <Badge variant="outline" className="border-border bg-surface text-[10px] text-secondary-text">
        Phase 5 · AI Conversation Engine
      </Badge>
    </div>
  );
}
