import { createHash, randomBytes } from "crypto";

import { db } from "@/lib/db";

/**
 * Single-use password reset tokens stored in the existing StoredBlob table.
 * No Prisma schema change is needed. Only the SHA-256 hash is persisted, so a
 * database snapshot cannot be used to reset an account.
 */

const TOKENS_KEY = "system:password-reset-tokens";
const TOKEN_TTL_MS = 60 * 60 * 1000;
const MAX_TOKENS = 200;

type ResetTokenRecord = {
  hash: string;
  email: string;
  createdAt: string;
  expiresAt: string;
  usedAt: string | null;
};

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

async function readTokens(): Promise<ResetTokenRecord[]> {
  const blob = await db.storedBlob.findUnique({ where: { key: TOKENS_KEY } });
  if (!blob) return [];
  try {
    const parsed = JSON.parse(Buffer.from(blob.data).toString("utf8"));
    return Array.isArray(parsed) ? (parsed as ResetTokenRecord[]) : [];
  } catch {
    return [];
  }
}

async function writeTokens(tokens: ResetTokenRecord[]) {
  const body = Buffer.from(JSON.stringify(tokens), "utf8");
  await db.storedBlob.upsert({
    where: { key: TOKENS_KEY },
    update: { data: body, contentType: "application/json", size: body.length },
    create: { key: TOKENS_KEY, data: body, contentType: "application/json", size: body.length },
  });
}

export async function createPasswordResetToken(email: string): Promise<string> {
  const now = Date.now();
  const tokens = (await readTokens()).filter(
    (token) => !token.usedAt && new Date(token.expiresAt).getTime() > now,
  );

  const raw = randomBytes(32).toString("hex");
  tokens.unshift({
    hash: hashToken(raw),
    email,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + TOKEN_TTL_MS).toISOString(),
    usedAt: null,
  });

  await writeTokens(tokens.slice(0, MAX_TOKENS));
  return raw;
}

/** Consumes a token atomically enough for a prototype and returns its email. */
export async function consumePasswordResetToken(token: string): Promise<string | null> {
  const hash = hashToken(token);
  const tokens = await readTokens();
  const record = tokens.find((item) => item.hash === hash);
  if (!record || record.usedAt || new Date(record.expiresAt).getTime() < Date.now()) {
    return null;
  }

  const consumedAt = new Date().toISOString();
  await writeTokens(
    tokens.map((item) => (item.hash === hash ? { ...item, usedAt: consumedAt } : item)),
  );
  return record.email;
}
