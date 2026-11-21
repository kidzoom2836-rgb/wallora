import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { db } from "./db";
import * as schema from "@wallora/database";
import { randomUUID } from "node:crypto";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
    },
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
  },
  user: {
    additionalFields: {
      username: { type: "string", required: false },
    },
  },
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          const username = (user as { username?: string }).username ?? user.email.split("@")[0];
          await db.insert(schema.profiles).values({
            id: randomUUID(),
            userId: user.id,
            username,
            displayName: user.name,
          });
          await db.insert(schema.userRoles).values({
            id: randomUUID(),
            userId: user.id,
            role: "user",
          });
        },
      },
    },
  },
  secret: process.env.BETTER_AUTH_SECRET!,
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
});
