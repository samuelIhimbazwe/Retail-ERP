"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { runPayroll, updateStaffSalary } from "@/lib/actions";
import { Badge, statusBadge } from "@/components/ui/badge";
import { KpiCard } from "@/components/ui/kpi-card";
import { Button, Input, Panel, Select } from "@/components/ui/primitives";
import { formatCurrency, cn } from "@/lib/utils";
import {
  Banknote,
  Building2,
  CheckSquare,
  Search,
  Square,
  Users,
  Wallet,
} from "lucide-react";

type StaffRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  dept: string;
  branch: string;
  shift: string;
  active: boolean;
  status: string;
  salary: number;
  salaryMonthly: number;
  payable: boolean;
};

type PayrollPayload = {
  monthLabel: string;
  activeEmployees: number;
  payableCount: number;
  payrollThisMonth: number;
  paidThisMonth: number;
  unpaidEstimate: number;
  onLeave: number;
  staff: StaffRow[];
  byDept: { dept: string; headcount: number; cost: number }[];
  liquid: { cash: number; bank: number; momo: number; salariesExpense: number };
  recentRuns: {
    id: string;
    number: string;
    description: string;
    amount: number;
    date: string;
  }[];
  canEditSalaries: boolean;
};

type PayFrom = "1000" | "1100" | "1200";

export function PayrollClient({ data }: { data: PayrollPayload }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [dept, setDept] = useState("All");
  const [selected, setSelected] = useState<Set<string>>(() => {
    const ids = data.staff.filter((s) => s.payable).map((s) => s.id);
    return new Set(ids);
  });
  const [fromCode, setFromCode] = useState<PayFrom>("1100");
  const [note, setNote] = useState("");
  const [showRun, setShowRun] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const [salaryDrafts, setSalaryDrafts] = useState<Record<string, string>>({});

  function saveSalary(userId: string) {
    const raw = salaryDrafts[userId];
    if (raw == null) return;
    const amount = Math.trunc(Number(raw.replace(/,/g, "")));
    if (!Number.isFinite(amount) || amount < 0) {
      setMessage({ ok: false, text: "Enter a valid salary" });
      return;
    }
    setMessage(null);
    startTransition(async () => {
      try {
        await updateStaffSalary({ userId, salaryMonthly: amount });
        setSalaryDrafts((d) => {
          const next = { ...d };
          delete next[userId];
          return next;
        });
        setMessage({ ok: true, text: "Salary saved" });
        router.refresh();
      } catch (e) {
        setMessage({ ok: false, text: e instanceof Error ? e.message : "Failed" });
      }
    });
  }

  const depts = useMemo(
    () => ["All", ...new Set(data.staff.map((s) => s.dept))],
    [data.staff],
  );

  const filtered = useMemo(() => {
    let list = data.staff;
    if (dept !== "All") list = list.filter((s) => s.dept === dept);
    const needle = q.trim().toLowerCase();
    if (needle) {
      list = list.filter(
        (s) =>
          s.name.toLowerCase().includes(needle) ||
          s.email.toLowerCase().includes(needle) ||
          s.role.toLowerCase().includes(needle),
      );
    }
    return list;
  }, [data.staff, q, dept]);

  const selectedPayable = useMemo(
    () => data.staff.filter((s) => selected.has(s.id) && s.payable),
    [data.staff, selected],
  );
  const selectedTotal = selectedPayable.reduce((s, e) => s + e.salary, 0);

  const fromBalance =
    fromCode === "1000"
      ? data.liquid.cash
      : fromCode === "1100"
        ? data.liquid.bank
        : data.liquid.momo;

  function toggle(id: string, payable: boolean) {
    if (!payable) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllVisible() {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const s of filtered) {
        if (s.payable) next.add(s.id);
      }
      return next;
    });
  }

  function clearSelection() {
    setSelected(new Set());
  }

  function submitRun() {
    setMessage(null);
    if (selectedPayable.length === 0) {
      setMessage({ ok: false, text: "Select at least one payable employee" });
      return;
    }
    startTransition(async () => {
      try {
        const result = await runPayroll({
          userIds: selectedPayable.map((s) => s.id),
          fromCode,
          note: note || undefined,
        });
        setMessage({
          ok: true,
          text: `Paid ${result.staffCount} staff · ${formatCurrency(result.total)} · ${result.journalNumber ?? "journal posted"}`,
        });
        setShowRun(false);
        setNote("");
        router.refresh();
      } catch (e) {
        setMessage({ ok: false, text: e instanceof Error ? e.message : "Payroll failed" });
      }
    });
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
            Employee & Payroll
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-muted">
            Roster from live users · role-based salary estimates · {data.monthLabel}
          </p>
        </div>
        <Button size="sm" onClick={() => setShowRun(true)} disabled={selectedPayable.length === 0}>
          <Banknote className="h-4 w-4" /> Run payroll
        </Button>
      </div>

      {message && (
        <p className={`mb-3 text-sm ${message.ok ? "text-brand-deep" : "text-danger"}`}>
          {message.text}
        </p>
      )}

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Active staff" value={data.activeEmployees} icon={Users} tone="brand" />
        <KpiCard
          label="Gross (est.)"
          value={data.payrollThisMonth}
          icon={Wallet}
          currency
          tone="accent"
        />
        <KpiCard
          label="Paid this month"
          value={data.paidThisMonth}
          icon={Banknote}
          currency
          tone="info"
        />
        <KpiCard
          label="Still due (est.)"
          value={data.unpaidEstimate}
          icon={Building2}
          currency
          tone={data.unpaidEstimate > 0 ? "warn" : "info"}
        />
      </div>

      {showRun && (
        <Panel
          title="Run payroll"
          subtitle={`${selectedPayable.length} selected · ${formatCurrency(selectedTotal)}`}
          className="mb-4"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-ink-muted">Pay from</label>
              <Select
                value={fromCode}
                onChange={(e) => setFromCode(e.target.value as PayFrom)}
              >
                <option value="1100">Bank ({formatCurrency(data.liquid.bank)})</option>
                <option value="1000">Cash ({formatCurrency(data.liquid.cash)})</option>
                <option value="1200">MoMo ({formatCurrency(data.liquid.momo)})</option>
              </Select>
              {fromBalance < selectedTotal && (
                <p className="mt-1 text-xs text-danger">
                  Short by {formatCurrency(selectedTotal - fromBalance)} — transfer funds in Banking
                  first.
                </p>
              )}
            </div>
            <div>
              <label className="mb-1 block text-xs text-ink-muted">Note (optional)</label>
              <Input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={`${data.monthLabel} salaries`}
              />
            </div>
          </div>
          <ul className="mt-3 max-h-40 overflow-y-auto rounded-lg border border-border text-sm">
            {selectedPayable.map((s) => (
              <li
                key={s.id}
                className="flex justify-between border-b border-border px-3 py-1.5 last:border-0"
              >
                <span>
                  {s.name}{" "}
                  <span className="text-xs text-ink-faint">
                    {s.role} · {s.dept}
                  </span>
                </span>
                <span className="font-medium">{formatCurrency(s.salary)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-ink-faint">
            Posts Dr Salaries (5200) / Cr selected liquid account. Owner is excluded.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button onClick={submitRun} disabled={pending || fromBalance < selectedTotal}>
              {pending ? "Posting…" : `Pay ${formatCurrency(selectedTotal)}`}
            </Button>
            <Button variant="ghost" onClick={() => setShowRun(false)}>
              Cancel
            </Button>
            <Link href="/banking" className="ml-auto">
              <Button variant="secondary" size="sm">
                Banking
              </Button>
            </Link>
          </div>
        </Panel>
      )}

      <div className="mb-4 grid gap-4 lg:grid-cols-3">
        <Panel title="By department" className="lg:col-span-1">
          <ul className="space-y-2 text-sm">
            {data.byDept.length === 0 && (
              <li className="text-ink-muted">No payable staff.</li>
            )}
            {data.byDept.map((d) => (
              <li
                key={d.dept}
                className="flex items-center justify-between rounded-lg border border-border px-3 py-2"
              >
                <div>
                  <p className="font-medium">{d.dept}</p>
                  <p className="text-xs text-ink-faint">{d.headcount} people</p>
                </div>
                <span className="font-medium">{formatCurrency(d.cost)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-ink-faint">
            YTD salaries expense ledger: {formatCurrency(data.liquid.salariesExpense)}
          </p>
        </Panel>

        <Panel title="Recent payroll runs" className="lg:col-span-2" bodyClassName="p-0">
          {data.recentRuns.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-ink-muted">
              No payroll journals this month yet.
            </p>
          ) : (
            <ul>
              {data.recentRuns.map((r) => (
                <li
                  key={r.id}
                  className="flex items-center justify-between gap-3 border-b border-border px-4 py-2.5 text-sm last:border-0"
                >
                  <div className="min-w-0">
                    <p className="font-medium">{r.number}</p>
                    <p className="truncate text-xs text-ink-faint">{r.description}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-medium">{formatCurrency(r.amount)}</p>
                    <p className="text-[10px] text-ink-faint">
                      {new Date(r.date).toLocaleString("en-GB", {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <div className="border-t border-border px-4 py-2">
            <Link href="/accounting" className="text-xs text-brand hover:underline">
              Open accounting journals →
            </Link>
          </div>
        </Panel>
      </div>

      <Panel
        title="Staff roster"
        subtitle={`${selectedPayable.length} selected · ${formatCurrency(selectedTotal)}`}
        actions={
          <div className="flex flex-wrap gap-1">
            <Button variant="ghost" size="sm" onClick={selectAllVisible}>
              Select visible
            </Button>
            <Button variant="ghost" size="sm" onClick={clearSelection}>
              Clear
            </Button>
          </div>
        }
        bodyClassName="p-0"
      >
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
          <div className="relative min-w-[180px] flex-1">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-faint" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search name, email, role…"
              className="h-8 pl-8 text-sm"
            />
          </div>
          <div className="flex flex-wrap gap-1">
            {depts.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDept(d)}
                className={cn(
                  "rounded-lg border px-2.5 py-1 text-xs font-medium",
                  dept === d
                    ? "border-brand bg-brand text-white"
                    : "border-border hover:border-brand",
                )}
              >
                {d}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface text-xs uppercase text-ink-faint">
              <tr>
                <th className="px-4 py-2 font-medium w-10" />
                <th className="px-4 py-2 font-medium">Employee</th>
                <th className="px-4 py-2 font-medium">Role</th>
                <th className="px-4 py-2 font-medium">Department</th>
                <th className="px-4 py-2 font-medium">Branch</th>
                <th className="px-4 py-2 font-medium">Shift</th>
                <th className="px-4 py-2 font-medium">Monthly salary</th>
                <th className="px-4 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-ink-muted">
                    No staff match.
                  </td>
                </tr>
              )}
              {filtered.map((e) => {
                const checked = selected.has(e.id);
                return (
                  <tr
                    key={e.id}
                    className={cn(
                      "border-t border-border",
                      checked && e.payable && "bg-brand-soft/20",
                    )}
                  >
                    <td className="px-4 py-2.5">
                      <button
                        type="button"
                        disabled={!e.payable}
                        onClick={() => toggle(e.id, e.payable)}
                        className={cn(
                          "text-ink-muted",
                          e.payable ? "hover:text-brand" : "opacity-30",
                        )}
                        aria-label={checked ? "Deselect" : "Select"}
                      >
                        {checked && e.payable ? (
                          <CheckSquare className="h-4 w-4 text-brand" />
                        ) : (
                          <Square className="h-4 w-4" />
                        )}
                      </button>
                    </td>
                    <td className="px-4 py-2.5">
                      <p className="font-medium">{e.name}</p>
                      <p className="text-[11px] text-ink-faint">{e.email}</p>
                    </td>
                    <td className="px-4 py-2.5">{e.role}</td>
                    <td className="px-4 py-2.5 text-ink-muted">{e.dept}</td>
                    <td className="px-4 py-2.5 text-ink-muted">{e.branch}</td>
                    <td className="px-4 py-2.5">{e.shift}</td>
                    <td className="px-4 py-2.5">
                      {data.canEditSalaries ? (
                        <div className="flex items-center gap-1">
                          <Input
                            className="h-8 w-28 text-sm"
                            value={
                              salaryDrafts[e.id] ??
                              String(e.salaryMonthly > 0 ? e.salaryMonthly : e.salary || "")
                            }
                            onChange={(ev) =>
                              setSalaryDrafts((d) => ({ ...d, [e.id]: ev.target.value }))
                            }
                            inputMode="numeric"
                          />
                          {salaryDrafts[e.id] != null && (
                            <Button
                              size="sm"
                              variant="secondary"
                              disabled={pending}
                              onClick={() => saveSalary(e.id)}
                            >
                              Save
                            </Button>
                          )}
                        </div>
                      ) : e.salary > 0 ? (
                        formatCurrency(e.salary)
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge variant={statusBadge(e.status)}>{e.status}</Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
