"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

import { initialsFrom, type AuthorSnapshot } from "./types";

export function CommunityAvatar({
  author,
  size = "md",
  className,
}: {
  author: AuthorSnapshot;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const [failed, setFailed] = React.useState(false);
  React.useEffect(() => setFailed(false), [author.avatarUrl]);

  const dimensions =
    size === "sm" ? "size-8 text-[11px]" : size === "lg" ? "size-12 text-sm" : "size-10 text-xs";

  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-raised font-semibold text-primary",
        dimensions,
        className,
      )}
      aria-hidden
    >
      {author.avatarUrl && !failed ? (
        <img
          src={author.avatarUrl}
          alt=""
          className="size-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        initialsFrom(author.displayName ?? author.username)
      )}
    </span>
  );
}
