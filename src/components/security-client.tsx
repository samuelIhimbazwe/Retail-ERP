"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createSecurityUser,
  resetSecurityUserPassword,
  updateSecurityUser,
} from "@/lib/actions";
import { Badge } from "@/components/ui/badge";
import { KpiCard } from "@/components/ui/kpi-card";
import { Button, Input, Panel, Select } from "@/components/ui/primitives";
import { downloadCsv, toCsv } from "@/lib/csv";
import { cn } from "@/lib/utils";
import {
  Download,
  KeyRound,
  Pencil,
  Search,
  Shield,
  UserPlus,
  Users,
  X,
} from "lucide-react";

const ROLES = ["OWNER", "MANAGER", "CASHIER", "ACCOUNTANT", "STOREKEEPER"] as const;
const RISK_FILTERS = ["All", "High", "Medium", "Low"] as const;
const CAT_FILTERS = ["All", "sale", "void", "journal", "stock"] as const;

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  branchId: string | null;
  branch: string;
  active: boolean;
  createdAt: string;
};

type AuditRow = {
  id: string;
  user: string;
  action: string;
  time: string;
  date: string;
  risk: "Low" | "Medium" | "High";
  category: "sale" | "void" | "journal" | "stock";
};

type SecurityPayload = {
  meId: string;
  meRole: string;
  canManage: boolean;
  activeUsers: number;
  totalUsers: number;
  highRisk: number;
  mediumRisk: number;
  roleCounts: Record<string, number>;
  branches: { id: string; name: string; code: string }[];
  users: UserRow[];
  audit: AuditRow[];
};

type FormMode = "closed" | "create" | "edit" | "password";

export function SecurityClient({ data }: { data: SecurityPayload }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [roleFilter, setRoleFilter] = useState("All");
  const [riskFilter, setRiskFilter] = useState<(typeof RISK_FILTERS)[number]>("All");
  const [catFilter, setCatFilter] = useState<(typeof CAT_FILTERS)[number]>("All");
  const [mode, setMode] = useState<FormMode>("closed");
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<(typeof ROLES)[number]>("CASHIER");
  const [branchId, setBranchId] = useState("");
  const [active, setActive] = useState(true);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const filteredUsers = useMemo(() => {
    let list = data.users;
    if (roleFilter !== "All") list = list.filter((u) => u.role === roleFilter);
    const needle = q.trim().toLowerCase();
    if (needle) {
      list = list.filter(
        (u) =>
          u.name.toLowerCase().includes(needle) ||
          u.email.toLowerCase().includes(needle),
      );
    }
    return list;
  }, [data.users, q, roleFilter]);

  const filteredAudit = useMemo(() => {
    let list = data.audit;
    if (riskFilter !== "All") list = list.filter((a) => a.risk === riskFilter);
    if (catFilter !== "All") list = list.filter((a) => a.category === catFilter);
    return list;
  }, [data.audit, riskFilter, catFilter]);

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
    setPassword("");
    setMessage(null);
  }

  function closeForm() {
    setMode("closed");
    setEditing(null);
    setMessage(null);
  }

  function save() {
    setMessage(null);
    startTransition(async () => {
      try {
        if (mode === "create") {
          await createSecurityUser({
            name,
            email,
            password,
            role,
            branchId: branchId || null,
          });
          setMessage({ ok: true, text: "User created" });
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

  function exportAudit() {
    const csv = toCsv(
      ["Date", "Time", "User", "Action", "Category", "Risk"],
      filteredAudit.map((a) => [a.date, a.time, a.user, a.action, a.category, a.risk]),
    );
    downloadCsv(`rbiap-audit-${new Date().toISOString().slice(0, 10)}.csv`, csv);
  }

  const rolesInUse = Object.keys(data.roleCounts).length;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
            Security & Audit
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-muted">
            Users, roles, and an audit trail from sales, journals, voids, and stock movements.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={exportAudit}>
            <Download className="h-4 w-4" /> Export audit
          </Button>
          {data.canManage && (
            <Button size="sm" onClick={openCreate}>
              <UserPlus className="h-4 w-4" /> Add user
            </Button>
          )}
        </div>
      </div>

      {message && mode === "closed" && (
        <p className={`mb-3 text-sm ${message.ok ? "text-brand-deep" : "text-danger"}`}>
          {message.text}
        </p>
      )}

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Active users" value={data.activeUsers} icon={Users} tone="brand" />
        <KpiCard label="Total accounts" value={data.totalUsers} icon={Shield} tone="info" />
        <KpiCard label="Roles in use" value={rolesInUse} icon={Users} tone="accent" />
        <KpiCard
          label="High-risk events"
          value={data.highRisk}
          icon={Shield}
          tone={data.highRisk ? "warn" : "info"}
        />
      </div>

      {mode !== "closed" && (
        <Panel
          className="mb-4"
          title={
            mode === "create"
              ? "New user"
              : mode === "password"
                ? `Reset password · ${editing?.name}`
                : `Edit ${editing?.name}`
          }
          actions={
            <button type="button" onClick={closeForm} className="rounded p-1 text-ink-muted hover:bg-surface">
              <X className="h-4 w-4" />
            </button>
          }
        >
          {mode === "password" ? (
            <div className="max-w-sm space-y-3">
              <div>
                <label className="mb-1 block text-xs text-ink-muted">New password</label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                />
              </div>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs text-ink-muted">Name</label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              {mode === "create" ? (
                <div>
                  <label className="mb-1 block text-xs text-ink-muted">Email</label>
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
                  <label className="mb-1 block text-xs text-ink-muted">Temp password</label>
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
                  {ROLES.filter((r) => data.meRole === "OWNER" || r !== "OWNER").map((r) => (
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
                  Active (can sign in)
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
                (mode === "create" && (!name.trim() || !email.trim() || password.length < 6)) ||
                (mode === "edit" && !name.trim()) ||
                (mode === "password" && password.length < 6)
              }
            >
              {pending
                ? "Saving…"
                : mode === "create"
                  ? "Create user"
                  : mode === "password"
                    ? "Reset password"
                    : "Save changes"}
            </Button>
            <Button variant="ghost" onClick={closeForm}>
              Cancel
            </Button>
          </div>
        </Panel>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel
          title="Users & roles"
          subtitle={data.canManage ? "Owner/Manager can edit" : "View only"}
          bodyClassName="p-0"
        >
          <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
            <div className="relative min-w-[140px] flex-1">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-faint" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search users…"
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
          </div>
          <div className="max-h-[28rem] overflow-y-auto">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-surface text-xs uppercase text-ink-faint">
                <tr>
                  <th className="px-4 py-2 font-medium">User</th>
                  <th className="px-4 py-2 font-medium">Role</th>
                  <th className="px-4 py-2 font-medium">Branch</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  {data.canManage && <th className="px-4 py-2 font-medium" />}
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((u) => (
                  <tr key={u.id} className="border-t border-border">
                    <td className="px-4 py-2.5">
                      <p className="font-medium">
                        {u.name}
                        {u.id === data.meId && (
                          <span className="ml-1 text-[10px] text-brand">you</span>
                        )}
                      </p>
                      <p className="text-[11px] text-ink-faint">{u.email}</p>
                    </td>
                    <td className="px-4 py-2.5">{u.role}</td>
                    <td className="px-4 py-2.5 text-ink-muted">{u.branch}</td>
                    <td className="px-4 py-2.5">
                      <Badge variant={u.active ? "success" : "default"}>
                        {u.active ? "Active" : "Off"}
                      </Badge>
                    </td>
                    {data.canManage && (
                      <td className="px-4 py-2.5">
                        <div className="flex gap-1">
                          <button
                            type="button"
                            className="rounded p-1 text-ink-muted hover:bg-surface hover:text-ink"
                            onClick={() => openEdit(u)}
                            title="Edit"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            className="rounded p-1 text-ink-muted hover:bg-surface hover:text-ink"
                            onClick={() => openPassword(u)}
                            title="Reset password"
                          >
                            <KeyRound className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border-t border-border px-4 py-2 text-xs text-ink-faint">
            <Link href="/users" className="text-brand hover:underline">
              Open User Management
            </Link>
            {" · "}
            <Link href="/settings" className="text-brand hover:underline">
              Password & profile settings
            </Link>
            {" · "}
            <Link href="/payroll" className="text-brand hover:underline">
              Payroll roster
            </Link>
          </div>
        </Panel>

        <Panel title="Audit log" subtitle={`${filteredAudit.length} events`} bodyClassName="p-0">
          <div className="flex flex-wrap gap-1 border-b border-border px-4 py-2">
            {RISK_FILTERS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRiskFilter(r)}
                className={cn(
                  "rounded-md px-2 py-0.5 text-[10px] font-medium",
                  riskFilter === r ? "bg-brand text-white" : "text-ink-muted hover:bg-surface",
                )}
              >
                {r}
              </button>
            ))}
            <span className="mx-1 text-ink-faint">|</span>
            {CAT_FILTERS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCatFilter(c)}
                className={cn(
                  "rounded-md px-2 py-0.5 text-[10px] font-medium capitalize",
                  catFilter === c ? "bg-brand text-white" : "text-ink-muted hover:bg-surface",
                )}
              >
                {c}
              </button>
            ))}
          </div>
          <div className="max-h-[28rem] overflow-y-auto">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-surface text-xs uppercase text-ink-faint">
                <tr>
                  <th className="px-4 py-2 font-medium">When</th>
                  <th className="px-4 py-2 font-medium">User</th>
                  <th className="px-4 py-2 font-medium">Action</th>
                  <th className="px-4 py-2 font-medium">Risk</th>
                </tr>
              </thead>
              <tbody>
                {filteredAudit.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-ink-muted">
                      No events in this filter
                    </td>
                  </tr>
                )}
                {filteredAudit.map((l) => (
                  <tr key={l.id} className="border-t border-border">
                    <td className="px-4 py-2.5 text-xs text-ink-faint whitespace-nowrap">
                      {l.date.slice(5)} {l.time}
                    </td>
                    <td className="px-4 py-2.5">{l.user}</td>
                    <td className="px-4 py-2.5 max-w-[14rem] truncate" title={l.action}>
                      {l.action}
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge
                        variant={
                          l.risk === "High" ? "danger" : l.risk === "Medium" ? "warn" : "success"
                        }
                      >
                        {l.risk}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>

      <Panel title="Role mix" className="mt-4">
        <ul className="flex flex-wrap gap-2">
          {ROLES.map((r) => (
            <li
              key={r}
              className="rounded-lg border border-border px-3 py-1.5 text-sm"
            >
              <span className="font-medium">{r}</span>
              <span className="ml-2 text-xs text-ink-faint">{data.roleCounts[r] ?? 0}</span>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}
