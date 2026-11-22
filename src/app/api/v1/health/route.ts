import { NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * GET /api/v1/health
 *
 * Runtime configuration diagnostic. Reports which environment variables are
 * present (booleans + masked URL structure — never raw secrets) and whether
 * the database connects. Use this to debug 500s on Vercel.
 */
export const dynamic = "force-dynamic";

/** Mask the password in a connection string for safe display. */
function maskUrl(url: string | undefined): string | null {
  if (!url) return null;
  return url.replace(/:[^:@]+@/, ":***@");
}

export async function GET() {
  const environment = {
    DATABASE_URL: !!process.env.DATABASE_URL,
    DATABASE_URL_masked: maskUrl(process.env.DATABASE_URL),
    NEXTAUTH_SECRET: !!process.env.NEXTAUTH_SECRET,
    NEXTAUTH_URL: process.env.NEXTAUTH_URL ?? null,
    VERCEL_URL: process.env.NEXT_PUBLIC_VERCEL_URL ?? process.env.VERCEL_URL ?? null,
    R2_CONFIGURED:
      !!process.env.R2_ACCOUNT_ID &&
      !!process.env.R2_ACCESS_KEY_ID &&
      !!process.env.R2_SECRET_ACCESS_KEY &&
      !!process.env.R2_BUCKET_NAME &&
      !!process.env.R2_PUBLIC_BASE_URL,
    BLOB_CONFIGURED: !!process.env.BLOB_READ_WRITE_TOKEN,
    EXPO_ACCESS_TOKEN: !!process.env.EXPO_ACCESS_TOKEN,
    NODE_ENV: process.env.NODE_ENV ?? null,
  };

  let database: {
    ok: boolean;
    userCount?: number;
    error?: string;
    errorCode?: string | null;
  } = { ok: false };

  if (environment.DATABASE_URL) {
    try {
      const userCount = await db.user.count();
      database = { ok: true, userCount };
    } catch (e) {
      const err = e as {
        message?: string;
        code?: string;
        errorCode?: string;
        name?: string;
      };
      database = {
        ok: false,
        error: (err.message || String(e)).slice(0, 800),
        errorCode: err.code ?? err.errorCode ?? err.name ?? null,
      };
    }
  } else {
    database = { ok: false, error: "DATABASE_URL not set" };
  }

  const ready = environment.DATABASE_URL && environment.NEXTAUTH_SECRET && database.ok;

  return NextResponse.json(
    {
      timestamp: new Date().toISOString(),
      environment,
      database,
      ready,
      hint: !ready
        ? "Missing env var(s) or DB unreachable. On Vercel: Project Settings → Environment Variables → set DATABASE_URL, NEXTAUTH_SECRET, NEXTAUTH_URL for Production+Preview+Development. Redeploy after adding."
        : "All required env vars present and database reachable.",
    },
    { status: ready ? 200 : 503 },
  );
}
