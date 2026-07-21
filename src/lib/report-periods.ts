export const REPORT_PERIODS = [
  { id: "today", label: "Today" },
  { id: "yesterday", label: "Yesterday" },
  { id: "this_week", label: "This week" },
  { id: "last_week", label: "Last week" },
  { id: "this_month", label: "This month" },
  { id: "last_month", label: "Last month" },
  { id: "this_quarter", label: "This quarter" },
  { id: "ytd", label: "Year to date" },
] as const;

export type ReportPeriodId = (typeof REPORT_PERIODS)[number]["id"];

export function isReportPeriodId(v: string | undefined | null): v is ReportPeriodId {
  return !!v && REPORT_PERIODS.some((p) => p.id === v);
}

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

/** Monday-start week (local). */
function startOfWeek(d: Date) {
  const x = startOfDay(d);
  const day = x.getDay(); // 0 Sun
  const diff = day === 0 ? -6 : 1 - day;
  return addDays(x, diff);
}

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}

function endOfMonth(d: Date) {
  return endOfDay(new Date(d.getFullYear(), d.getMonth() + 1, 0));
}

function startOfQuarter(d: Date) {
  const q = Math.floor(d.getMonth() / 3) * 3;
  return new Date(d.getFullYear(), q, 1, 0, 0, 0, 0);
}

export type ReportRange = {
  period: ReportPeriodId;
  label: string;
  shortLabel: string;
  start: Date;
  end: Date;
  /** How to bucket the trend chart */
  trendMode: "hour" | "day" | "week" | "month";
};

export function resolveReportRange(period: ReportPeriodId = "this_month"): ReportRange {
  const now = new Date();
  const today = startOfDay(now);

  switch (period) {
    case "today": {
      return {
        period,
        label: today.toLocaleDateString("en-GB", {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        }),
        shortLabel: "Today",
        start: today,
        end: endOfDay(now),
        trendMode: "hour",
      };
    }
    case "yesterday": {
      const y = addDays(today, -1);
      return {
        period,
        label: y.toLocaleDateString("en-GB", {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        }),
        shortLabel: "Yesterday",
        start: y,
        end: endOfDay(y),
        trendMode: "hour",
      };
    }
    case "this_week": {
      const start = startOfWeek(today);
      return {
        period,
        label: `Week of ${start.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} – ${endOfDay(now).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`,
        shortLabel: "This week",
        start,
        end: endOfDay(now),
        trendMode: "day",
      };
    }
    case "last_week": {
      const thisWeek = startOfWeek(today);
      const start = addDays(thisWeek, -7);
      const end = endOfDay(addDays(thisWeek, -1));
      return {
        period,
        label: `${start.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} – ${end.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`,
        shortLabel: "Last week",
        start,
        end,
        trendMode: "day",
      };
    }
    case "this_month": {
      const start = startOfMonth(today);
      return {
        period,
        label: today.toLocaleDateString("en-GB", { month: "long", year: "numeric" }),
        shortLabel: "This month",
        start,
        end: endOfDay(now),
        trendMode: "day",
      };
    }
    case "last_month": {
      const start = startOfMonth(new Date(today.getFullYear(), today.getMonth() - 1, 1));
      const end = endOfMonth(start);
      return {
        period,
        label: start.toLocaleDateString("en-GB", { month: "long", year: "numeric" }),
        shortLabel: "Last month",
        start,
        end,
        trendMode: "day",
      };
    }
    case "this_quarter": {
      const start = startOfQuarter(today);
      const q = Math.floor(today.getMonth() / 3) + 1;
      return {
        period,
        label: `Q${q} ${today.getFullYear()}`,
        shortLabel: `Q${q}`,
        start,
        end: endOfDay(now),
        trendMode: "week",
      };
    }
    case "ytd":
    default: {
      const start = new Date(today.getFullYear(), 0, 1);
      return {
        period: "ytd",
        label: `${today.getFullYear()} year to date`,
        shortLabel: "YTD",
        start,
        end: endOfDay(now),
        trendMode: "month",
      };
    }
  }
}
