import type { Role } from "@prisma/client";
import type { NavGroup } from "@/lib/navigation";

/** Path prefixes each non-admin role may open. OWNER and MANAGER may open everything. */
const ROLE_PREFIXES: Record<"CASHIER" | "STOREKEEPER" | "ACCOUNTANT", string[]> = {
  CASHIER: [
    "/counter",
    "/pos",
    "/stock-check",
    "/receive",
    "/quick-pay",
    "/dashboard",
    "/notifications",
    "/ai",
    "/products",
    "/inventory",
    "/customers",
    "/loyalty",
    "/settings",
  ],
  STOREKEEPER: [
    "/counter",
    "/stock-check",
    "/receive",
    "/dashboard",
    "/notifications",
    "/ai",
    "/products",
    "/inventory",
    "/warehouse",
    "/purchasing",
    "/procurement",
    "/settings",
  ],
  ACCOUNTANT: [
    "/dashboard",
    "/bi",
    "/ai",
    "/notifications",
    "/reports",
    "/customers",
    "/loyalty",
    "/accounting",
    "/tax",
    "/banking",
    "/payroll",
    "/settings",
  ],
};

export function canAccessPath(role: string, pathname: string): boolean {
  if (role === "OWNER" || role === "MANAGER") return true;
  const prefixes = ROLE_PREFIXES[role as keyof typeof ROLE_PREFIXES];
  if (!prefixes) return false;
  return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function navigationForRole(role: string, groups: NavGroup[]): NavGroup[] {
  return groups
    .map((g) => ({
      ...g,
      items: g.items.filter((item) => canAccessPath(role, item.href)),
    }))
    .filter((g) => g.items.length > 0);
}

export function canManageBusinessSettings(role: string) {
  return role === "OWNER" || role === "MANAGER";
}

export function canManageUsers(role: string) {
  return role === "OWNER" || role === "MANAGER";
}

export function canViewSecurity(role: string) {
  return role === "OWNER" || role === "MANAGER";
}

export function canRunPayroll(role: string) {
  return role === "OWNER" || role === "MANAGER" || role === "ACCOUNTANT";
}

export function assertRole(role: string, allowed: Role | Role[], message = "You do not have access") {
  const list = Array.isArray(allowed) ? allowed : [allowed];
  if (!list.includes(role as Role)) throw new Error(message);
}

/** Default monthly salary (RWF) by role — used when creating staff / seeding. */
export function defaultSalaryForRole(role: string) {
  const map: Record<string, number> = {
    OWNER: 0,
    MANAGER: 650_000,
    CASHIER: 280_000,
    ACCOUNTANT: 520_000,
    STOREKEEPER: 320_000,
  };
  return map[role] ?? 300_000;
}
