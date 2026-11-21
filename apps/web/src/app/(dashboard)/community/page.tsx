"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Heart, MessageCircle, Plus, Users, Loader2 } from "lucide-react";
import { EmptyState } from "@/components/wallora/empty-state";

interface Post {
  id: string; caption: string | null; imageUrl: string | null; createdAt: string;
  userId: string; username: string | null; displayName: string | null;
  likeCount: number; likedByMe: boolean;
}

export default function CommunityPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [caption, setCaption] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [creating, setCreating] = useState(false);
  const [openComments, setOpenComments] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");
  const [comments, setComments] = useState<Record<string, { id: string; body: string; username: string | null }[]>>({});

  const load = async () => {
    setLoading(true);
    const res = await fetch("/api/v1/community/posts");
    const data = await res.json();
    setPosts(data.posts ?? []);
    setLoading(false);
  };

  useEffect(() => { void load(); }, []); // eslint-disable-line react-hooks/set-state-in-effect

  const create = async () => {
    if (!caption.trim() && !imageUrl.trim()) return;
    setCreating(true);
    await fetch("/api/v1/community/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ caption, imageUrl: imageUrl || null }),
    });
    setCaption(""); setImageUrl("");
    setCreating(false);
    load();
  };

  const toggleLike = async (id: string) => {
    await fetch(`/api/v1/community/posts/${id}/like`, { method: "POST" });
    load();
  };

  const loadComments = async (id: string) => {
    if (openComments === id) { setOpenComments(null); return; }
    setOpenComments(id);
    const res = await fetch(`/api/v1/community/posts/${id}/comments`);
    const data = await res.json();
    setComments((c) => ({ ...c, [id]: data.comments ?? [] }));
  };

  const addComment = async (id: string) => {
    if (!commentText.trim()) return;
    await fetch(`/api/v1/community/posts/${id}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: commentText }),
    });
    setCommentText("");
    loadComments(id);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Community</h1>

      <Card>
        <CardContent className="space-y-3 p-4">
          <Textarea value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Share something with the community…" className="min-h-[80px]" />
          <Input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="Image URL (optional)" />
          <div className="flex justify-end">
            <Button onClick={create} disabled={creating || (!caption.trim() && !imageUrl.trim())}>
              {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
              Post
            </Button>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : posts.length === 0 ? (
        <EmptyState icon={Users} title="No posts yet" description="Be the first to share something." />
      ) : (
        <div className="space-y-4">
          {posts.map((p) => (
            <Card key={p.id}>
              <CardContent className="space-y-3 p-4">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-medium">
                    {(p.username ?? "?").slice(0, 2).toUpperCase()}
                  </div>
                  <span className="text-sm font-medium">{p.displayName ?? p.username ?? "Anonymous"}</span>
                </div>
                {p.caption && <p className="text-sm">{p.caption}</p>}
                {p.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.imageUrl} alt="" className="max-h-80 w-full rounded-lg object-cover" />
                )}
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <button onClick={() => toggleLike(p.id)} className={`flex items-center gap-1 ${p.likedByMe ? "text-primary" : ""}`}>
                    <Heart className="h-4 w-4" /> {p.likeCount}
                  </button>
                  <button onClick={() => loadComments(p.id)} className="flex items-center gap-1">
                    <MessageCircle className="h-4 w-4" /> Comments
                  </button>
                </div>
                {openComments === p.id && (
                  <div className="space-y-2 border-t border-border pt-3">
                    {(comments[p.id] ?? []).map((c) => (
                      <p key={c.id} className="text-sm"><span className="font-medium">{c.username ?? "anon"}:</span> {c.body}</p>
                    ))}
                    <div className="flex gap-2">
                      <Input value={commentText} onChange={(e) => setCommentText(e.target.value)} placeholder="Add a comment…" />
                      <Button size="sm" onClick={() => addComment(p.id)}>Send</Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
