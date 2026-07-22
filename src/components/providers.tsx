"use client";

import { SessionProvider, useSession, signOut as nextAuthSignOut } from "next-auth/react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type RemoteUser = {
  id: string;
  email: string;
  name: string;
  role: string;
  businessId: string;
  branchId: string | null;
  businessName: string;
  branchName: string | null;
};

type RemoteSessionValue = {
  data: { user: RemoteUser } | null;
  status: "loading" | "authenticated" | "unauthenticated";
  refresh: () => Promise<void>;
  signOutRemote: () => Promise<void>;
};

const RemoteSessionContext = createContext<RemoteSessionValue | null>(null);

const splitMode =
  typeof process !== "undefined" &&
  Boolean(process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_SPLIT_DEPLOY === "1");

function RemoteSessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<RemoteUser | null>(null);
  const [status, setStatus] = useState<RemoteSessionValue["status"]>("loading");

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/session/me", { cache: "no-store" });
      if (!res.ok) {
        setUser(null);
        setStatus("unauthenticated");
        return;
      }
      const data = await res.json();
      if (data?.user) {
        setUser(data.user);
        setStatus("authenticated");
      } else {
        setUser(null);
        setStatus("unauthenticated");
      }
    } catch {
      setUser(null);
      setStatus("unauthenticated");
    }
  }, []);

  const signOutRemote = useCallback(async () => {
    await fetch("/api/session", { method: "DELETE" });
    setUser(null);
    setStatus("unauthenticated");
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo(
    () => ({
      data: user ? { user } : null,
      status,
      refresh,
      signOutRemote,
    }),
    [user, status, refresh, signOutRemote],
  );

  return <RemoteSessionContext.Provider value={value}>{children}</RemoteSessionContext.Provider>;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  if (splitMode) {
    return (
      <SessionProvider>
        <RemoteSessionProvider>{children}</RemoteSessionProvider>
      </SessionProvider>
    );
  }
  return <SessionProvider>{children}</SessionProvider>;
}

/** Compatible session hook for monolith (Auth.js) and split (API JWT) deploys. */
export function useAppSession() {
  const remote = useContext(RemoteSessionContext);
  const next = useSession();

  if (splitMode && remote) {
    return {
      data: remote.data
        ? {
            user: {
              ...remote.data.user,
              email: remote.data.user.email,
              name: remote.data.user.name,
            },
          }
        : null,
      status: remote.status,
      signOut: remote.signOutRemote,
    };
  }

  return {
    data: next.data,
    status: next.status,
    signOut: async () => {
      await nextAuthSignOut({ callbackUrl: "/login" });
    },
  };
}
