import { createHash, randomBytes } from "crypto";

export { TERMS_OF_USE, TERMS_VERSION } from "@/lib/terms";

export function generateInviteToken() {
  return randomBytes(32).toString("hex");
}

export function hashInviteToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function inviteExpiryDate(days = 7) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

/** Password reset links expire sooner than invites. */
export function resetExpiryDate(hours = 24) {
  const d = new Date();
  d.setHours(d.getHours() + hours);
  return d;
}
