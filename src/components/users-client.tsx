"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createPasswordResetLink,
  createSecurityUser,
  createUserInvite,
  resetSecurityUserPassword,
  revokeUserInvite,
  updateSecurityUser,
} from "@/lib/actions";
import { Badge } from "@/components/ui/badge";
import { KpiCard } from "@/components/ui/kpi-card";
import { Button, Input, Panel, Select } from "@/components/ui/primitives";
import { downloadCsv, toCsv } from "@/lib/csv";
import { formatCurrency, cn } from "@/lib/utils";
import {
  Copy,
  Download,
  KeyRound,
  Mail,
  MailPlus,
  Pencil,
  Search,
  Shield,
  UserPlus,
  UserRoundCog,
  Users,
  X,
} from "lucide-react";

const ROLES = ["OWNER", "MANAGER", "CASHIER", "ACCOUNTANT", "STOREKEEPER"] as const;
const STATUS_FILTERS = ["All", "Active", "Inactive"] as const;

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  branchId: string | null;
  branch: string;
  active: boolean;
  createdAt: string;
  saleCount: number;
  lastSaleAt: string | null;
  lastSaleNumber: string | null;
  lastSaleTotal: number | null;
};

type InviteRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  branch: string;
  invitedBy: string;
  expiresAt: string;
  createdAt: string;
};

type AllowedPayload = {
  allowed: true;
  meId: string;
  meRole: string;
  meName: string;
  activeUsers: number;
  inactiveUsers: number;
  totalUsers: number;
  pendingInvites: number;
  roleCounts: Record<string, number>;
  branches: { id: string; name: string; code: string }[];
  invites: InviteRow[];
  users: UserRow[];
};

type DeniedPayload = {
  allowed: false;
  meId: string;
  meRole: string;
  meName: string;
};

type FormMode = "closed" | "invite" | "create" | "edit" | "password";

type LastInvite = {
  inviteUrl: string;
  mailtoHref: string;
  email: string;
  name: string;
  expiresAt: string;
  emailed: boolean;
  mailError: string | null;
};

type LastReset = {
  resetUrl: string;
  mailtoHref: string;
  email: string;
  name: string;
  expiresAt: string;
  emailed: boolean;
  mailError: string | null;
};

const roleBadge: Record<string, "brand" | "info" | "success" | "warn" | "default"> = {
  OWNER: "brand",
  MANAGER: "info",
  ACCOUNTANT: "success",
  CASHIER: "default",
  STOREKEEPER: "warn",
};

export function UsersClient({ data }: { data: AllowedPayload | DeniedPayload }) {
  if (!data.allowed) {
    return (
      <div className="mx-auto max-w-lg py-16 text-center">
        <Shield className="mx-auto h-10 w-10 text-ink-faint" />
        <h1 className="mt-4 font-display text-2xl font-semibold">Admin only</h1>
        <p className="mt-2 text-sm text-ink-muted">
          User Management is limited to Owner and Manager. You are signed in as{" "}
          <span className="font-medium text-ink">{data.meName}</span> ({data.meRole}).
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <Link href="/settings">
            <Button variant="secondary" size="sm">
              Your settings
            </Button>
          </Link>
          <Link href="/dashboard">
            <Button size="sm">Dashboard</Button>
          </Link>
        </div>
      </div>
    );
  }

  return <UsersAdminPanel data={data} />;
}

function UsersAdminPanel({ data }: { data: AllowedPayload }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [roleFilter, setRoleFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_FILTERS)[number]>("All");
  const [selectedId, setSelectedId] = useState<string | null>(data.users[0]?.id ?? null);
  const [mode, setMode] = useState<FormMode>("closed");
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<(typeof ROLES)[number]>("CASHIER");
  const [branchId, setBranchId] = useState("");
  const [active, setActive] = useState(true);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [lastInvite, setLastInvite] = useState<LastInvite | null>(null);
  const [lastReset, setLastReset] = useState<LastReset | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    let list = data.users;
    if (roleFilter !== "All") list = list.filter((u) => u.role === roleFilter);
    if (statusFilter === "Active") list = list.filter((u) => u.active);
    if (statusFilter === "Inactive") list = list.filter((u) => !u.active);
    const needle = q.trim().toLowerCase();
    if (needle) {
      list = list.filter(
        (u) =>
          u.name.toLowerCase().includes(needle) ||
          u.email.toLowerCase().includes(needle) ||
          u.role.toLowerCase().includes(needle) ||
          u.branch.toLowerCase().includes(needle),
      );
    }
    return list;
  }, [data.users, q, roleFilter, statusFilter]);

  const selected =
    data.users.find((u) => u.id === selectedId) ??
    filtered[0] ??
    null;

  function openInvite() {
    setMode("invite");
    setEditing(null);
    setName("");
    setEmail("");
    setPassword("");
    setRole("CASHIER");
    setBranchId(data.branches[0]?.id ?? "");
    setActive(true);
    setMessage(null);
    setLastInvite(null);
  }

  function openCreate() {
    setMode("create");
    setEditing(null);
    setName("");
    setEmail("");
    setPassword("");
    setRole("CASHIER");
    setBranchId(data.branches[0]?.id ?? "");
    setActive(true);
    setMessage(null);
  }

  function openEdit(u: UserRow) {
    setMode("edit");
    setEditing(u);
    setSelectedId(u.id);
    setName(u.name);
    setEmail(u.email);
    setPassword("");
    setRole(u.role as (typeof ROLES)[number]);
    setBranchId(u.branchId ?? "");
    setActive(u.active);
    setMessage(null);
  }

  function openPassword(u: UserRow) {
    setMode("password");
    setEditing(u);
    setSelectedId(u.id);
    setPassword("");
    setMessage(null);
    setLastReset(null);
  }

  function createResetLink(u: UserRow) {
    setMessage(null);
    setLastReset(null);
    startTransition(async () => {
      try {
        const result = await createPasswordResetLink({
          userId: u.id,
          appOrigin: typeof window !== "undefined" ? window.location.origin : undefined,
        });
        setLastReset({
          resetUrl: result.resetUrl,
          mailtoHref: result.mailtoHref,
          email: result.email,
          name: result.name,
          expiresAt: result.expiresAt,
          emailed: result.emailed,
          mailError: result.mailError,
        });
        setMessage({
          ok: true,
          text: result.emailed
            ? `Reset link emailed to ${result.email}.`
            : result.mailError
              ? `Reset link created, but email failed (${result.mailError}). Copy the link below.`
              : `Reset link ready for ${result.email} (24h). Copy or open email (SMTP not configured).`,
        });
        setSelectedId(u.id);
      } catch (e) {
        setMessage({ ok: false, text: e instanceof Error ? e.message : "Failed" });
      }
    });
  }

  function closeForm() {
    setMode("closed");
    setEditing(null);
  }

  function save() {
    setMessage(null);
    startTransition(async () => {
      try {
        if (mode === "invite") {
          const result = await createUserInvite({
            name,
            email,
            role,
            branchId: branchId || null,
            appOrigin: typeof window !== "undefined" ? window.location.origin : undefined,
          });
          setLastInvite({
            inviteUrl: result.inviteUrl,
            mailtoHref: result.mailtoHref,
            email: result.email,
            name: result.name,
            expiresAt: result.expiresAt,
            emailed: result.emailed,
            mailError: result.mailError,
          });
          setMessage({
            ok: true,
            text: result.emailed
              ? `Invite emailed to ${result.email}.`
              : result.mailError
                ? `Invite created, but email failed (${result.mailError}). Copy the link below.`
                : `Invite ready for ${result.email}. Copy the link or open email (SMTP not configured).`,
          });
          closeForm();
          router.refresh();
          return;
        }
        if (mode === "create") {
          await createSecurityUser({
            name,
            email,
            password,
            role,
            branchId: branchId || null,
          });
          setMessage({ ok: true, text: "User created with temporary password" });
        } else if (mode === "edit" && editing) {
          await updateSecurityUser({
            id: editing.id,
            name,
            role,
            branchId: branchId || null,
            isActive: active,
          });
          setMessage({ ok: true, text: "User updated" });
        } else if (mode === "password" && editing) {
          await resetSecurityUserPassword({ id: editing.id, newPassword: password });
          setMessage({ ok: true, text: "Password reset" });
        }
        closeForm();
        router.refresh();
      } catch (e) {
        setMessage({ ok: false, text: e instanceof Error ? e.message : "Failed" });
      }
    });
  }

  function revokeInvite(id: string) {
    setMessage(null);
    startTransition(async () => {
      try {
        await revokeUserInvite(id);
        setMessage({ ok: true, text: "Invite revoked" });
        router.refresh();
      } catch (e) {
        setMessage({ ok: false, text: e instanceof Error ? e.message : "Failed" });
      }
    });
  }

  async function copyInviteLink() {
    if (!lastInvite) return;
    try {
      await navigator.clipboard.writeText(lastInvite.inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setMessage({ ok: false, text: "Could not copy — select the link manually" });
    }
  }

  async function copyResetLink() {
    if (!lastReset) return;
    try {
      await navigator.clipboard.writeText(lastReset.resetUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setMessage({ ok: false, text: "Could not copy — select the link manually" });
    }
  }

  function exportUsers() {
    const csv = toCsv(
      ["Name", "Email", "Role", "Branch", "Active", "Sales", "Created", "Last sale"],
      filtered.map((u) => [
        u.name,
        u.email,
        u.role,
        u.branch,
        u.active ? "Yes" : "No",
        u.saleCount,
        u.createdAt,
        u.lastSaleAt?.slice(0, 10) ?? "",
      ]),
    );
    downloadCsv(`rbiap-users-${new Date().toISOString().slice(0, 10)}.csv`, csv);
  }

  const roleOptions =
    data.meRole === "OWNER" ? ROLES : ROLES.filter((r) => r !== "OWNER");

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
            User Management
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-muted">
            Invite teammates by email — they accept terms and set their own password. Signed in as{" "}
            {data.meName} ({data.meRole}).
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={exportUsers}>
            <Download className="h-4 w-4" /> Export CSV
          </Button>
          <Link href="/security">
            <Button variant="ghost" size="sm">
              <Shield className="h-4 w-4" /> Audit log
            </Button>
          </Link>
          <Button variant="secondary" size="sm" onClick={openCreate}>
            <UserPlus className="h-4 w-4" /> Temp password
          </Button>
          <Button size="sm" onClick={openInvite}>
            <MailPlus className="h-4 w-4" /> Invite user
          </Button>
        </div>
      </div>

      {message && mode === "closed" && (
        <p className={`mb-3 text-sm ${message.ok ? "text-brand-deep" : "text-danger"}`}>
          {message.text}
        </p>
      )}

      {lastInvite && mode === "closed" && (
        <Panel
          className="mb-4"
          title={`Invite ready · ${lastInvite.name}`}
          subtitle={lastInvite.email}
          actions={
            <button
              type="button"
              onClick={() => setLastInvite(null)}
              className="rounded p-1 text-ink-muted hover:bg-surface"
            >
              <X className="h-4 w-4" />
            </button>
          }
        >
          <p className="mb-2 text-xs text-ink-muted">
            Expires {new Date(lastInvite.expiresAt).toLocaleString("en-GB")}.
            {lastInvite.emailed
              ? " Email sent via SMTP."
              : " Share the link below if the recipient did not get email."}
          </p>
          <div className="flex flex-wrap gap-2">
            <Input readOnly value={lastInvite.inviteUrl} className="min-w-0 flex-1 text-xs" />
            <Button size="sm" variant="secondary" onClick={copyInviteLink}>
              <Copy className="h-3.5 w-3.5" /> {copied ? "Copied" : "Copy link"}
            </Button>
            <a href={lastInvite.mailtoHref}>
              <Button size="sm" variant="secondary">
                <Mail className="h-3.5 w-3.5" /> Open email
              </Button>
            </a>
          </div>
        </Panel>
      )}

      {lastReset && mode === "closed" && (
        <Panel
          className="mb-4"
          title={`Password reset · ${lastReset.name}`}
          subtitle={lastReset.email}
          actions={
            <button
              type="button"
              onClick={() => setLastReset(null)}
              className="rounded p-1 text-ink-muted hover:bg-surface"
            >
              <X className="h-4 w-4" />
            </button>
          }
        >
          <p className="mb-2 text-xs text-ink-muted">
            Expires {new Date(lastReset.expiresAt).toLocaleString("en-GB")}. One-time link.
            {lastReset.emailed
              ? " Email sent via SMTP."
              : " Share securely if the recipient did not get email."}
          </p>
          <div className="flex flex-wrap gap-2">
            <Input readOnly value={lastReset.resetUrl} className="min-w-0 flex-1 text-xs" />
            <Button size="sm" variant="secondary" onClick={copyResetLink}>
              <Copy className="h-3.5 w-3.5" /> {copied ? "Copied" : "Copy link"}
            </Button>
            <a href={lastReset.mailtoHref}>
              <Button size="sm" variant="secondary">
                <Mail className="h-3.5 w-3.5" /> Open email
              </Button>
            </a>
          </div>
        </Panel>
      )}

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Total users" value={data.totalUsers} icon={Users} tone="brand" />
        <KpiCard label="Active" value={data.activeUsers} icon={UserRoundCog} tone="accent" />
        <KpiCard
          label="Pending invites"
          value={data.pendingInvites}
          icon={MailPlus}
          tone="warn"
        />
        <KpiCard
          label="Roles in use"
          value={Object.keys(data.roleCounts).length}
          icon={Shield}
          tone="info"
        />
      </div>

      {mode !== "closed" && (
        <Panel
          className="mb-4"
          title={
            mode === "invite"
              ? "Invite user"
              : mode === "create"
                ? "Create with temporary password"
                : mode === "password"
                  ? `Set temporary password · ${editing?.name}`
                  : `Edit · ${editing?.name}`
          }
          actions={
            <button type="button" onClick={closeForm} className="rounded p-1 text-ink-muted hover:bg-surface">
              <X className="h-4 w-4" />
            </button>
          }
        >
          {mode === "invite" && (
            <p className="mb-3 text-xs text-ink-muted">
              They will open a secure link, accept the terms, and choose their own password. If SMTP
              is configured in .env, the invite is emailed; otherwise copy the link or use mailto.
            </p>
          )}
          {mode === "password" ? (
            <div className="max-w-sm space-y-3">
              <p className="text-xs text-ink-muted">
                Prefer the secure reset link (user chooses their own password). Use this only to set
                a temporary password yourself.
              </p>
              <div>
                <label className="mb-1 block text-xs text-ink-muted">Temporary password (min 8)</label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  minLength={8}
                />
              </div>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs text-ink-muted">Full name</label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              {mode === "invite" || mode === "create" ? (
                <div>
                  <label className="mb-1 block text-xs text-ink-muted">Email (login)</label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="off"
                  />
                </div>
              ) : (
                <div>
                  <label className="mb-1 block text-xs text-ink-muted">Email</label>
                  <Input value={email} readOnly />
                </div>
              )}
              {mode === "create" && (
                <div>
                  <label className="mb-1 block text-xs text-ink-muted">Temporary password</label>
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                  />
                </div>
              )}
              <div>
                <label className="mb-1 block text-xs text-ink-muted">Role</label>
                <Select
                  value={role}
                  onChange={(e) => setRole(e.target.value as (typeof ROLES)[number])}
                >
                  {roleOptions.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-ink-muted">Branch</label>
                <Select value={branchId} onChange={(e) => setBranchId(e.target.value)}>
                  <option value="">Unassigned</option>
                  {data.branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.code})
                    </option>
                  ))}
                </Select>
              </div>
              {mode === "edit" && (
                <label className="flex items-center gap-2 text-sm text-ink-muted sm:col-span-2">
                  <input
                    type="checkbox"
                    checked={active}
                    onChange={(e) => setActive(e.target.checked)}
                    disabled={editing?.id === data.meId}
                    className="rounded border-border"
                  />
                  Active — can sign in
                  {editing?.id === data.meId && (
                    <span className="text-xs text-ink-faint">(cannot deactivate yourself)</span>
                  )}
                </label>
              )}
            </div>
          )}
          {message && (
            <p className={`mt-2 text-sm ${message.ok ? "text-brand-deep" : "text-danger"}`}>
              {message.text}
            </p>
          )}
          <div className="mt-3 flex gap-2">
            <Button
              onClick={save}
              disabled={
                pending ||
                (mode === "invite" && (!name.trim() || !email.trim())) ||
                (mode === "create" && (!name.trim() || !email.trim() || password.length < 6)) ||
                (mode === "edit" && !name.trim()) ||
                (mode === "password" && password.length < 8)
              }
            >
              {pending
                ? "Saving…"
                : mode === "invite"
                  ? "Create invite"
                  : mode === "create"
                    ? "Create user"
                    : mode === "password"
                      ? "Set temporary password"
                      : "Save changes"}
            </Button>
            <Button variant="ghost" onClick={closeForm}>
              Cancel
            </Button>
          </div>
        </Panel>
      )}

      {data.invites.length > 0 && mode === "closed" && (
        <Panel
          className="mb-4"
          title="Pending invites"
          subtitle={`${data.invites.length} open · expire in up to 7 days`}
          bodyClassName="p-0"
        >
          <table className="w-full text-left text-sm">
            <thead className="bg-surface text-xs uppercase text-ink-faint">
              <tr>
                <th className="px-4 py-2 font-medium">Invitee</th>
                <th className="px-4 py-2 font-medium">Role</th>
                <th className="px-4 py-2 font-medium">Expires</th>
                <th className="px-4 py-2 font-medium">By</th>
                <th className="px-4 py-2 text-right font-medium"> </th>
              </tr>
            </thead>
            <tbody>
              {data.invites.map((inv) => (
                <tr key={inv.id} className="border-t border-border">
                  <td className="px-4 py-2.5">
                    <p className="font-medium">{inv.name}</p>
                    <p className="text-[11px] text-ink-faint">{inv.email}</p>
                  </td>
                  <td className="px-4 py-2.5">
                    <Badge variant={roleBadge[inv.role] ?? "default"}>{inv.role}</Badge>
                  </td>
                  <td className="px-4 py-2.5 text-ink-muted">
                    {new Date(inv.expiresAt).toLocaleDateString("en-GB")}
                  </td>
                  <td className="px-4 py-2.5 text-ink-muted">{inv.invitedBy}</td>
                  <td className="px-4 py-2.5 text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={pending}
                      onClick={() => revokeInvite(inv.id)}
                    >
                      Revoke
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      )}

      <div className="grid gap-4 lg:grid-cols-5">
        <Panel
          title="Directory"
          subtitle={`${filtered.length} shown`}
          className="lg:col-span-3"
          bodyClassName="p-0"
        >
          <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
            <div className="relative min-w-[160px] flex-1">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-faint" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search name, email, role…"
                className="h-8 pl-8 text-sm"
              />
            </div>
            <Select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="h-8 w-auto text-xs"
            >
              <option value="All">All roles</option>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </Select>
            <div className="flex gap-1">
              {STATUS_FILTERS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatusFilter(s)}
                  className={cn(
                    "rounded-lg border px-2.5 py-1 text-xs font-medium",
                    statusFilter === s
                      ? "border-brand bg-brand text-white"
                      : "border-border hover:border-brand",
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="max-h-[36rem] overflow-y-auto">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-surface text-xs uppercase text-ink-faint">
                <tr>
                  <th className="px-4 py-2 font-medium">User</th>
                  <th className="px-4 py-2 font-medium">Role</th>
                  <th className="px-4 py-2 font-medium">Branch</th>
                  <th className="px-4 py-2 text-right font-medium">Sales</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-ink-muted">
                      No users match.
                    </td>
                  </tr>
                )}
                {filtered.map((u) => (
                  <tr
                    key={u.id}
                    className={cn(
                      "cursor-pointer border-t border-border hover:bg-surface",
                      selected?.id === u.id && "bg-brand-soft/40",
                    )}
                    onClick={() => {
                      setSelectedId(u.id);
                      setMode("closed");
                    }}
                  >
                    <td className="px-4 py-2.5">
                      <p className="font-medium">
                        {u.name}
                        {u.id === data.meId && (
                          <span className="ml-1 text-[10px] text-brand">you</span>
                        )}
                      </p>
                      <p className="text-[11px] text-ink-faint">{u.email}</p>
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge variant={roleBadge[u.role] ?? "default"}>{u.role}</Badge>
                    </td>
                    <td className="px-4 py-2.5 text-ink-muted">{u.branch}</td>
                    <td className="px-4 py-2.5 text-right font-medium">{u.saleCount}</td>
                    <td className="px-4 py-2.5">
                      <Badge variant={u.active ? "success" : "default"}>
                        {u.active ? "Active" : "Off"}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <div className="space-y-4 lg:col-span-2">
          {selected ? (
            <Panel
              title={selected.name}
              subtitle={selected.email}
              actions={<Badge variant={roleBadge[selected.role] ?? "default"}>{selected.role}</Badge>}
            >
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-xs text-ink-faint">Branch</dt>
                  <dd className="font-medium">{selected.branch}</dd>
                </div>
                <div>
                  <dt className="text-xs text-ink-faint">Status</dt>
                  <dd>
                    <Badge variant={selected.active ? "success" : "default"}>
                      {selected.active ? "Active" : "Inactive"}
                    </Badge>
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-ink-faint">Joined</dt>
                  <dd>{selected.createdAt}</dd>
                </div>
                <div>
                  <dt className="text-xs text-ink-faint">Completed sales</dt>
                  <dd className="font-medium">{selected.saleCount}</dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-xs text-ink-faint">Last sale</dt>
                  <dd>
                    {selected.lastSaleAt
                      ? `${selected.lastSaleNumber} · ${formatCurrency(selected.lastSaleTotal ?? 0)} · ${selected.lastSaleAt.slice(0, 10)}`
                      : "—"}
                  </dd>
                </div>
              </dl>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" onClick={() => openEdit(selected)}>
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={pending || !selected.active}
                  onClick={() => createResetLink(selected)}
                >
                  <KeyRound className="h-3.5 w-3.5" /> Reset link
                </Button>
                <Button size="sm" variant="ghost" onClick={() => openPassword(selected)}>
                  Temp password
                </Button>
                {selected.active && selected.id !== data.meId && (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={pending}
                    onClick={() => {
                      startTransition(async () => {
                        try {
                          await updateSecurityUser({
                            id: selected.id,
                            name: selected.name,
                            role: selected.role as (typeof ROLES)[number],
                            branchId: selected.branchId,
                            isActive: false,
                          });
                          setMessage({ ok: true, text: `${selected.name} deactivated` });
                          router.refresh();
                        } catch (e) {
                          setMessage({
                            ok: false,
                            text: e instanceof Error ? e.message : "Failed",
                          });
                        }
                      });
                    }}
                  >
                    Deactivate
                  </Button>
                )}
                {!selected.active && (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={pending}
                    onClick={() => {
                      startTransition(async () => {
                        try {
                          await updateSecurityUser({
                            id: selected.id,
                            name: selected.name,
                            role: selected.role as (typeof ROLES)[number],
                            branchId: selected.branchId,
                            isActive: true,
                          });
                          setMessage({ ok: true, text: `${selected.name} reactivated` });
                          router.refresh();
                        } catch (e) {
                          setMessage({
                            ok: false,
                            text: e instanceof Error ? e.message : "Failed",
                          });
                        }
                      });
                    }}
                  >
                    Reactivate
                  </Button>
                )}
              </div>
            </Panel>
          ) : (
            <Panel title="Select a user">
              <p className="text-sm text-ink-muted">Choose someone from the directory.</p>
            </Panel>
          )}

          <Panel title="Role mix">
            <ul className="space-y-2 text-sm">
              {ROLES.map((r) => (
                <li
                  key={r}
                  className="flex items-center justify-between rounded-lg border border-border px-3 py-2"
                >
                  <span className="font-medium">{r}</span>
                  <span className="text-xs text-ink-faint">{data.roleCounts[r] ?? 0}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-ink-faint">
              Owner / Manager only. At least one active Owner is required.
            </p>
          </Panel>
        </div>
      </div>
    </div>
  );
}
