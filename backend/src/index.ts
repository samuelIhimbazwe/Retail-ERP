import "dotenv/config";
import express from "express";
import cors from "cors";
import { compare } from "bcryptjs";
import { prisma } from "../../src/lib/db";
import { signApiToken, verifyApiToken, type ApiUser } from "../../src/lib/api-token";
import { runWithSession } from "../../src/lib/session-als";
import * as domainActions from "../../src/lib/domain-actions";
import * as domainBootstrap from "../../src/lib/domain-bootstrap";
import type { Session } from "next-auth";

const app = express();
const port = Number(process.env.PORT || 4000);

const webOrigins = (process.env.WEB_ORIGIN || process.env.AUTH_URL || "http://localhost:3000")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: webOrigins,
    credentials: true,
  }),
);
app.use(express.json({ limit: "2mb" }));

const publicMethods = new Set([
  "isBootstrapped",
  "bootstrapBusiness",
  "getInvitePreview",
  "acceptUserInvite",
  "getPasswordResetPreview",
  "acceptPasswordReset",
]);

const catalog = {
  ...domainActions,
  ...domainBootstrap,
} as Record<string, (...args: unknown[]) => Promise<unknown>>;

function sessionFromUser(user: ApiUser): Session {
  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      businessId: user.businessId,
      branchId: user.branchId,
      businessName: user.businessName,
      branchName: user.branchName,
    },
    expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  };
}

async function userFromAuthHeader(req: express.Request): Promise<ApiUser | null> {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return null;
  try {
    return await verifyApiToken(header.slice(7));
  } catch {
    return null;
  }
}

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "rbiap-api" });
});

app.get("/auth/me", async (req, res) => {
  const user = await userFromAuthHeader(req);
  if (!user) {
    res.status(401).json({ ok: false, error: "Unauthorized" });
    return;
  }
  res.json({ ok: true, user });
});

app.post("/auth/login", async (req, res) => {
  try {
    const email = String(req.body?.email || "")
      .trim()
      .toLowerCase();
    const password = String(req.body?.password || "");
    if (!email || !password) {
      res.status(400).json({ ok: false, error: "Email and password required" });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { email },
      include: { business: true, branch: true },
    });
    if (!user || !user.isActive) {
      res.status(401).json({ ok: false, error: "Invalid email or password" });
      return;
    }

    const valid = await compare(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ ok: false, error: "Invalid email or password" });
      return;
    }

    const apiUser: ApiUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      businessId: user.businessId,
      branchId: user.branchId,
      businessName: user.business.name,
      branchName: user.branch?.name ?? null,
    };

    const token = await signApiToken(apiUser);
    res.json({ ok: true, token, user: apiUser });
  } catch (e) {
    res.status(500).json({ ok: false, error: e instanceof Error ? e.message : "Login failed" });
  }
});

app.post("/rpc", async (req, res) => {
  try {
    const method = String(req.body?.method || "");
    const args = Array.isArray(req.body?.args) ? (req.body.args as unknown[]) : [];
    const fn = catalog[method];
    if (!fn) {
      res.status(404).json({ ok: false, error: `Unknown method: ${method}` });
      return;
    }

    const needsAuth = !publicMethods.has(method);
    const apiUser = await userFromAuthHeader(req);
    if (needsAuth && !apiUser) {
      res.status(401).json({ ok: false, error: "Unauthorized" });
      return;
    }

    const run = async () => fn(...args);
    const result = apiUser
      ? await runWithSession(sessionFromUser(apiUser), run)
      : await run();

    res.json({ ok: true, result });
  } catch (e) {
    const message = e instanceof Error ? e.message : "RPC failed";
    const status = message === "Unauthorized" ? 401 : 400;
    res.status(status).json({ ok: false, error: message });
  }
});

app.listen(port, () => {
  console.log(`RBIAP API listening on :${port}`);
  console.log(`CORS web origins: ${webOrigins.join(", ")}`);
});
