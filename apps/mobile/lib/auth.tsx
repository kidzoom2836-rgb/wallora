import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import * as SecureStore from "expo-secure-store";
import {
  apiFetch,
  apiJson,
  clearSession,
  getCsrfToken,
  initSession,
  onUnauthorized,
  persistSession,
  signInBody,
} from "./api";

export interface User {
  id: string;
  name: string;
  email: string;
  role?: string;
  image?: string | null;
  username?: string;
  bio?: string | null;
  avatarUrl?: string | null;
  verified?: boolean;
  verificationTier?: "free" | "verified" | "premium" | "supreme";
  creatorStatus?: string | null;
  displayName?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signUp: (name: string, username: string, email: string, password: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const USER_STORE_KEY = "wallora_user";
const AuthContext = createContext<AuthContextType | null>(null);

function messageOf(e: any, fallback: string): string {
  return e?.message ?? fallback;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const loadUser = async () => {
    try {
      const fresh = await apiJson<any>("/api/v1/auth/me");
      const profile = fresh?.profile ?? {};
      const mapped: User = {
        id: fresh.id,
        name: fresh.name ?? profile.displayName ?? "WALLORA User",
        email: fresh.email,
        role: fresh.role,
        image: fresh.image,
        username: profile.username,
        bio: profile.bio,
        avatarUrl: profile.avatarUrl,
        verified: profile.verified,
        verificationTier: fresh.verificationTier ?? "free",
        creatorStatus: profile.creatorStatus,
        displayName: profile.displayName,
      };
      setUser(mapped);
      await SecureStore.setItemAsync(USER_STORE_KEY, JSON.stringify(mapped));
      return mapped;
    } catch (e) {
      setUser(null);
      throw e;
    }
  };

  useEffect(() => {
    // A 401 from any screen means the stored session is stale. Clear it so the
    // user is sent back to sign-in instead of seeing repeated auth errors.
    return onUnauthorized(async () => {
      await clearSession();
      await SecureStore.deleteItemAsync(USER_STORE_KEY).catch(() => {});
      setUser(null);
    });
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const saved = await initSession();
        if (saved) {
          await loadUser();
        } else {
          // Never restore a cached user without a session cookie — that would
          // leave the app looking signed in while every API call returns 401.
          await SecureStore.deleteItemAsync(USER_STORE_KEY).catch(() => {});
          setUser(null);
        }
      } catch {
        await clearSession();
        await SecureStore.deleteItemAsync(USER_STORE_KEY).catch(() => {});
        setUser(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      const csrf = await getCsrfToken();
      const res = await apiFetch("/api/auth/callback/credentials", {
        method: "POST",
        rawBody: true,
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: signInBody(csrf, email, password),
      });
      if (!res.ok) {
        return { error: "Invalid email or password." };
      }
      await persistSession();
      try {
        await loadUser();
      } catch {
        return { error: "Signed in, but the session could not be verified. Please try again." };
      }
      return {};
    } catch (e: any) {
      return { error: messageOf(e, "Could not sign in. Check your connection.") };
    }
  };

  const signUp = async (name: string, username: string, email: string, password: string) => {
    try {
      const res = await apiFetch("/api/v1/auth/register", {
        method: "POST",
        body: JSON.stringify({
          displayName: name,
          username,
          email,
          password,
          acceptTerms: true,
        }),
      });
      const text = await res.text();
      let data: any = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        /* ignore */
      }
      if (!res.ok) {
        const details = data?.error?.details;
        const detail = Array.isArray(details) && details[0]?.message ? ` — ${details[0].message}` : "";
        return { error: `${data?.error?.message ?? "Registration failed."}${detail}` };
      }
      // Registration creates the account; sign in to establish the session.
      return await signIn(email, password);
    } catch (e: any) {
      return { error: messageOf(e, "Could not register. Check your connection.") };
    }
  };

  const signOut = async () => {
    try {
      const csrf = await getCsrfToken();
      const body = new URLSearchParams();
      body.set("csrfToken", csrf);
      body.set("json", "true");
      await apiFetch("/api/auth/signout", {
        method: "POST",
        rawBody: true,
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
      });
    } catch {
      // Local sign-out still succeeds if the server is unreachable.
    }
    await clearSession();
    await SecureStore.deleteItemAsync(USER_STORE_KEY).catch(() => {});
    setUser(null);
  };

  const refresh = async () => {
    try {
      await loadUser();
    } catch {
      /* keep existing user on transient failure */
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
