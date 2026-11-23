/**
 * Client-side mirror of the backend community delete authorization.
 * The server remains the source of truth; this only decides which controls to show.
 */
export function canDeletePost(
  user: { id: string; role?: string } | null,
  post: { author?: { id?: string } | null } | null,
): boolean {
  if (!user?.id || !post?.author?.id) return false;
  return post.author.id === user.id || user.role === "super_admin";
}

export function deleteErrorMessage(error: any): string {
  if (error?.status === 404) return "This post was already deleted.";
  if (error?.status === 403) return "You cannot delete this post.";
  return error?.message ?? "Could not delete this post.";
}
