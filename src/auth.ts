import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db";
import type { Role } from "@prisma/client";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(4),
});

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      role: Role;
      businessId: string;
      branchId: string | null;
      businessName: string;
      branchName: string | null;
    };
  }

  interface User {
    role: Role;
    businessId: string;
    branchId: string | null;
    businessName: string;
    branchName: string | null;
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id: string;
    role: Role;
    businessId: string;
    branchId: string | null;
    businessName: string;
    branchName: string | null;
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;

        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email.toLowerCase() },
          include: {
            business: true,
            branch: true,
          },
        });

        if (!user || !user.isActive) return null;

        const valid = await compare(parsed.data.password, user.passwordHash);
        if (!valid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          businessId: user.businessId,
          branchId: user.branchId,
          businessName: user.business.name,
          branchName: user.branch?.name ?? null,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id!;
        token.role = user.role;
        token.businessId = user.businessId;
        token.branchId = user.branchId;
        token.businessName = user.businessName;
        token.branchName = user.branchName;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
        session.user.businessId = token.businessId;
        session.user.branchId = token.branchId;
        session.user.businessName = token.businessName;
        session.user.branchName = token.branchName;
        session.user.email = token.email ?? session.user.email;
        session.user.name = token.name ?? session.user.name;
      }
      return session;
    },
  },
});

import { getAlsSession } from "@/lib/session-als";

export async function requireSession() {
  const als = getAlsSession();
  if (als?.user?.id && als.user.businessId) {
    return als;
  }

  const session = await auth();
  if (!session?.user?.id || !session.user.businessId) {
    throw new Error("Unauthorized");
  }

  const businessOk = await prisma.business.findUnique({
    where: { id: session.user.businessId },
    select: { id: true },
  });
  if (businessOk) return session;

  // After db:reset, JWT ids are stale — recover by email (Node-only, not Edge middleware)
  const email = session.user.email?.toLowerCase();
  if (!email) throw new Error("Unauthorized");

  const fresh = await prisma.user.findUnique({
    where: { email },
    include: { business: true, branch: true },
  });
  if (!fresh?.isActive) {
    throw new Error("Session expired — sign out and sign in again after a DB reset");
  }

  return {
    ...session,
    user: {
      ...session.user,
      id: fresh.id,
      role: fresh.role,
      businessId: fresh.businessId,
      branchId: fresh.branchId,
      businessName: fresh.business.name,
      branchName: fresh.branch?.name ?? null,
      name: fresh.name,
      email: fresh.email,
    },
  };
}
