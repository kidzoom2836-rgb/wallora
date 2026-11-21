"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Send, Sparkles, Plus, Trash2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const modes = [
  "Creative Assistant", "Wallpaper Expert", "Graphic Designer", "Photo Editor",
  "Brand Consultant", "Interior Designer", "Fashion Assistant", "Story Creator",
  "Visual Inspiration Assistant",
];

export default function AiChatPage() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [mode, setMode] = useState(modes[0]);

  const [loading, setLoading] = useState(false);
  const send = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    const next = [...messages, { role: "user" as const, content: userMsg }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/v1/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next, mode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Request failed");
      setMessages((m) => [...m, { role: "assistant", content: data.content }]);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Request failed";
      setMessages((m) => [...m, { role: "assistant", content: `Error: ${msg}` }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">WALLORA AI</h1>
        <div className="flex items-center gap-2">
          <Select value={mode} onValueChange={(v) => v && setMode(v)}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              {modes.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" aria-label="New chat"><Plus className="h-4 w-4" /></Button>
          <Button variant="outline" size="icon" aria-label="Delete chat"><Trash2 className="h-4 w-4" /></Button>
        </div>
      </div>

      <div className="grid flex-1 gap-4 md:grid-cols-[240px_1fr]">
        <Card className="hidden p-3 md:block">
          <p className="mb-2 text-xs font-medium text-muted-foreground">Conversations</p>
          <div className="space-y-1 text-sm text-muted-foreground">
            <p className="rounded-md bg-muted px-2 py-1.5 text-foreground">New conversation</p>
          </div>
        </Card>

        <Card className="flex flex-col overflow-hidden">
          <div className="flex-1 space-y-4 overflow-y-auto p-4">
            {messages.length === 0 && (
              <div className="flex h-full items-center justify-center text-center text-sm text-muted-foreground">
                <div>
                  <Sparkles className="mx-auto mb-2 h-8 w-8 text-primary" />
                  Start a conversation. Try: &quot;Give me five wallpapers for a dark minimalist phone setup.&quot;
                </div>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
                  m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"
                }`}>
                  {m.content}
                </div>
              </div>
            ))}
          </div>
          <div className="border-t border-border p-3">
            <div className="flex items-end gap-2">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                placeholder="Message WALLORA AI…"
                className="min-h-[44px] resize-none"
              />
              <Button onClick={send} size="icon" aria-label="Send" disabled={loading}>
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}