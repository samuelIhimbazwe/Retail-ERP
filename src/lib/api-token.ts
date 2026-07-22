import { SignJWT, jwtVerify } from "jose";
import type { Role } from "@prisma/client";

export type ApiUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
  businessId: string;
  branchId: string | null;
  businessName: string;
  branchName: string | null;
};

function secretKey() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is required");
  return new TextEncoder().encode(secret);
}

export async function signApiToken(user: ApiUser) {
  return new SignJWT({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    businessId: user.businessId,
    branchId: user.branchId,
    businessName: user.businessName,
    branchName: user.branchName,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secretKey());
}

export async function verifyApiToken(token: string): Promise<ApiUser> {
  const { payload } = await jwtVerify(token, secretKey());
  return {
    id: String(payload.id),
    email: String(payload.email),
    name: String(payload.name),
    role: payload.role as Role,
    businessId: String(payload.businessId),
    branchId: payload.branchId ? String(payload.branchId) : null,
    businessName: String(payload.businessName),
    branchName: payload.branchName ? String(payload.branchName) : null,
  };
}
