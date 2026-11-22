import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";

import { db } from "@/lib/db";

/**
 * WALLORA NextAuth configuration.
 *
 * Strategy: JWT (no Prisma adapter needed for credentials provider).
 * The credentials provider verifies email + password against the User table
 * via Prisma + bcryptjs. Role and username are attached to the JWT and
 * surfaced on the session for both client (useSession) and server
 * (getServerSession) consumers.
 *
 * Server-side role enforcement happens in the API layer — never trust the
 * client. See src/lib/auth-helpers.ts for requireUser / requireRole.
 */
export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  secret: process.env.NEXTAUTH_SECRET,
  pages: {
    // We use dialogs, not pages — but if a raw NextAuth flow ever redirects,
    // send it home rather than to a non-existent default page.
    signIn: "/",
    error: "/",
  },
  providers: [
    CredentialsProvider({
      name: "WALLORA",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email?.trim().toLowerCase();
        const password = credentials?.password;

        if (!email || !password) {
          return null;
        }

        const user = await db.user.findUnique({
          where: { email },
          include: { profile: { select: { username: true, avatarUrl: true } } },
        });

        if (!user || !user.passwordHash) {
          return null;
        }

        if (user.status !== "active") {
          return null;
        }

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.profile?.avatarUrl ?? user.image,
          role: user.role,
          username: user.profile?.username ?? null,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      // On initial sign-in, `user` is the object returned from authorize.
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.username = user.username;
        token.image = user.image;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id ?? "";
        session.user.role = token.role ?? "user";
        session.user.username = token.username ?? null;
        session.user.name = token.name ?? session.user.name;
        session.user.email = token.email ?? session.user.email;
        session.user.image = token.image ?? session.user.image;
      }
      return session;
    },
  },
  events: {
    async signIn({ user, isNewUser }) {
      // Lightweight audit trail — appended on every sign-in.
      try {
        await db.auditLog.create({
          data: {
            actorId: user.id,
            action: isNewUser ? "auth.register" : "auth.login",
            targetType: "user",
            targetId: user.id,
          },
        });
      } catch {
        // Audit failures must never block auth.
      }
    },
  },
};
