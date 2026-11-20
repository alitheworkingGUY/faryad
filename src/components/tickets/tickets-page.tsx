"use client";

import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, LocateFixed, Search, SearchX, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AppShell, PageHeader } from "@/components/shared/app-shell";
import { CategoryTile } from "@/components/shared/category";
import { DeptChip, PriorityBadge, SlaChip, StatusBadge } from "@/components/shared/chips";
import { SelectBox } from "@/components/shared/controls";
import { EmptyState, ErrorState, LoadingState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useNow } from "@/hooks/use-now";
import {
  CATEGORIES,
  CATEGORY_META,
  PRIORITIES,
  STATUS_META,
  STATUSES,
  type TicketDTO,
} from "@/lib/domain";
import { formatDateTime, startOfTodayPK, timeAgo } from "@/lib/format";
import { Bi, useLang } from "@/lib/i18n";
import { useLive } from "@/lib/store";
import { useUI } from "@/lib/ui-store";
import { cn } from "@/lib/utils";

type SortKey = "ticketNo" | "createdAt" | "slaDueAt" | "priority" | "status" | "area";
const PAGE_SIZE = 12;

function SortHeader({
  label,
  labelUr,
  sortKey,
  sort,
  onSort,
  className,
}: {
  label: string;
  labelUr: string;
  sortKey: SortKey;
  sort: { key: SortKey; dir: 1 | -1 };
  onSort: (key: SortKey) => void;
  className?: string;
}) {
  const active = sort.key === sortKey;
  const Icon = !active ? ArrowUpDown : sort.dir === 1 ? ArrowUp : ArrowDown;
  return (
    <th className={cn("px-4 py-3 text-start font-medium", className)} aria-sort={active ? (sort.dir === 1 ? "ascending" : "descending") : "none"}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={cn("flex items-center gap-1.5 text-xs tracking-wide uppercase transition-colors", active ? "text-fg" : "text-dim hover:text-fg")}
      >
        <Bi en={label} ur={labelUr} only />
        <Icon className={cn("size-3.5", !active && "opacity-50")} />
      </button>
    </th>
  );
}

function Body() {
  const { t, isUr } = useLang();
  const tickets = useLive((s) => s.tickets);
  const areas = useLive((s) => s.areas);
  const departments = useLive((s) => s.departments);
  const loaded = useLive((s) => s.loaded);
  const error = useLive((s) => s.error);
  const openTicket = useUI((s) => s.openTicket);
  const selected = useUI((s) => s.drawerTicketNo);
  const now = useNow(30_000);

  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [category, setCategory] = useState("all");
  const [area, setArea] = useState("all");
  const [dept, setDept] = useState("all");
  const [date, setDate] = useState("all");
  const [breached, setBreached] = useState(false);
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "createdAt", dir: -1 });
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const today = startOfTodayPK(now);
    const rows = tickets.filter((x) => {
      if (status !== "all" && x.status !== status) return false;
      if (category !== "all" && x.category !== category) return false;
      if (area !== "all" && String(x.areaId) !== area) return false;
      if (dept !== "all" && x.departmentCode !== dept) return false;
      if (date === "today" && x.createdAt < today) return false;
      if (date === "last2h" && x.createdAt < now - 2 * 3_600_000) return false;
      if (breached) {
        const late = x.status === "resolved" ? (x.resolvedAt ?? 0) > x.slaDueAt : x.slaDueAt < now;
        if (!late) return false;
      }
      if (q) {
        const hay = `${x.ticketNo} ${x.callerName} ${x.areaEn} ${x.areaUr} ${x.descriptionEn} ${x.descriptionUr} ${x.departmentCode}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    const order = (x: TicketDTO): number | string => {
      switch (sort.key) {
        case "ticketNo":
          return Number(x.ticketNo.replace(/\D/g, ""));
        case "priority":
          return PRIORITIES.indexOf(x.priority);
        case "status":
          return STATUSES.indexOf(x.status);
        case "area":
          return x.areaEn;
        default:
          return x[sort.key];
      }
    };
    return rows.sort((a, b) => {
      const av = order(a);
      const bv = order(b);
      return (av < bv ? -1 : av > bv ? 1 : 0) * sort.dir;
    });
  }, [tickets, query, status, category, area, dept, date, breached, sort, now]);

  useEffect(() => setPage(0), [query, status, category, area, dept, date, breached]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pages - 1);
  const rows = filtered.slice(current * PAGE_SIZE, current * PAGE_SIZE + PAGE_SIZE);
  const hasFilters =
    query || status !== "all" || category !== "all" || area !== "all" || dept !== "all" || date !== "all" || breached;

  function onSort(key: SortKey) {
    setSort((s) => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: key === "createdAt" ? -1 : 1 }));
  }

  function clear() {
    setQuery("");
    setStatus("all");
    setCategory("all");
    setArea("all");
    setDept("all");
    setDate("all");
    setBreached(false);
  }

  return (
    <div className="flex h-dvh flex-col">
      <PageHeader
        en="Tickets"
        ur="شکایات"
        hint="Every complaint registered by the helpline. Click a row for the full record, transcript and actions."
      >
        <span className="text-sm text-dim">
          <span className="font-semibold text-fg tnum">{filtered.length}</span> of{" "}
          <span className="tnum">{tickets.length}</span>
        </span>
      </PageHeader>

      <div className="flex flex-wrap items-center gap-2.5 px-8 py-4">
        <div className="relative w-72">
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-dim" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("Search number, name, area, text…", "نمبر، نام، علاقہ تلاش کریں…")}
            className="h-10 border-line bg-panel ps-9 text-sm"
          />
        </div>
        <SelectBox
          label="Status"
          value={status}
          onChange={setStatus}
          options={[{ value: "all", label: "All statuses" }, ...STATUSES.map((s) => ({ value: s, label: STATUS_META[s].en }))]}
        />
        <SelectBox
          label="Category"
          value={category}
          onChange={setCategory}
          options={[{ value: "all", label: "All categories" }, ...CATEGORIES.map((c) => ({ value: c, label: CATEGORY_META[c].en }))]}
        />
        <SelectBox
          label="Area"
          value={area}
          onChange={setArea}
          options={[{ value: "all", label: "All areas" }, ...areas.map((a) => ({ value: String(a.id), label: a.nameEn }))]}
        />
        <SelectBox
          label="Department"
          value={dept}
          onChange={setDept}
          options={[{ value: "all", label: "All departments" }, ...departments.map((d) => ({ value: d.code, label: d.code }))]}
        />
        <SelectBox
          label="Date"
          value={date}
          onChange={setDate}
          options={[
            { value: "all", label: "Any time" },
            { value: "today", label: "Today" },
            { value: "last2h", label: "Last 2 hours" },
          ]}
        />
        <button
          type="button"
          aria-pressed={breached}
          onClick={() => setBreached((b) => !b)}
          className={cn(
            "flex h-10 items-center gap-2 rounded-lg border px-3 text-sm font-medium transition-colors",
            breached ? "border-danger/60 bg-danger/15 text-danger" : "border-line bg-panel text-dim hover:text-fg",
          )}
        >
          <span className={cn("size-2 rounded-full", breached ? "bg-danger" : "bg-dim/50")} />
          <Bi en="SLA breached" ur="مدت سے تجاوز" only />
        </button>
        {hasFilters && (
          <Button variant="ghost" size="lg" onClick={clear} className="h-10 text-dim">
            <X /> Clear
          </Button>
        )}
      </div>

      <div className="min-h-0 flex-1 px-8 pb-6">
        <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-panel">
          {error && !loaded ? (
            <ErrorState message={error} onRetry={() => useLive.getState().load()} />
          ) : !loaded ? (
            <LoadingState label="Loading tickets" />
          ) : rows.length === 0 ? (
            <EmptyState
              icon={SearchX}
              title="No tickets match"
              titleUr="کوئی شکایت نہیں ملی"
              hint="Try a different search or clear the filters."
            >
              {hasFilters && (
                <Button variant="outline" size="lg" onClick={clear}>
                  Clear filters
                </Button>
              )}
            </EmptyState>
          ) : (
            <div className="scroll-thin min-h-0 flex-1 overflow-auto">
              <table className="w-full min-w-[1100px] border-collapse text-sm">
                <thead className="sticky top-0 z-10 bg-panel shadow-[0_1px_0_#1f2a44]">
                  <tr>
                    <SortHeader label="Ticket" labelUr="نمبر" sortKey="ticketNo" sort={sort} onSort={onSort} className="ps-5" />
                    <th className="px-4 py-3 text-start text-xs font-medium tracking-wide text-dim uppercase">
                      <Bi en="Complaint" ur="شکایت" only />
                    </th>
                    <SortHeader label="Area" labelUr="علاقہ" sortKey="area" sort={sort} onSort={onSort} />
                    <th className="px-4 py-3 text-start text-xs font-medium tracking-wide text-dim uppercase">
                      <Bi en="Dept" ur="محکمہ" only />
                    </th>
                    <SortHeader label="Status" labelUr="حالت" sortKey="status" sort={sort} onSort={onSort} />
                    <SortHeader label="Priority" labelUr="ترجیح" sortKey="priority" sort={sort} onSort={onSort} />
                    <SortHeader label="SLA" labelUr="مدت" sortKey="slaDueAt" sort={sort} onSort={onSort} />
                    <SortHeader label="Registered" labelUr="اندراج" sortKey="createdAt" sort={sort} onSort={onSort} className="pe-5" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((x) => (
                    <tr
                      key={x.ticketNo}
                      onClick={() => openTicket(x.ticketNo)}
                      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && openTicket(x.ticketNo)}
                      tabIndex={0}
                      className={cn(
                        "cursor-pointer border-t border-line/70 outline-none transition-colors duration-150 hover:bg-panel-2 focus-visible:bg-panel-2",
                        selected === x.ticketNo && "bg-live/10",
                      )}
                    >
                      <td className="py-3 ps-5 pe-4">
                        <div className="flex items-center gap-3">
                          <CategoryTile category={x.category} size="sm" />
                          <div>
                            <p className="font-semibold text-fg tnum">{x.ticketNo}</p>
                            <p className="text-xs" style={{ color: CATEGORY_META[x.category].color }}>
                              {t(CATEGORY_META[x.category].en, CATEGORY_META[x.category].ur)}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="max-w-[360px] px-4 py-3">
                        <p
                          dir={isUr ? "rtl" : "ltr"}
                          className={cn("truncate text-fg", isUr && "ur ur-tight")}
                          title={x.descriptionEn}
                        >
                          {isUr ? x.descriptionUr : x.descriptionEn}
                        </p>
                        <p className="truncate text-xs text-dim">
                          {x.callerName} · <span className="tnum">{x.phoneMasked}</span>
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-1.5 text-fg">
                          {t(x.areaEn, x.areaUr)}
                          {x.locationSource === "gps" && <LocateFixed className="size-3.5 text-live" aria-label="Exact GPS" />}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <DeptChip code={x.departmentCode} />
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={x.status} />
                      </td>
                      <td className="px-4 py-3">
                        <PriorityBadge priority={x.priority} />
                      </td>
                      <td className="px-4 py-3">
                        <SlaChip ticket={x} />
                      </td>
                      <td className="py-3 ps-4 pe-5 whitespace-nowrap">
                        <p className="text-fg tnum">{formatDateTime(x.createdAt)}</p>
                        <p className="text-xs text-dim">{timeAgo(x.createdAt, now)}</p>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {loaded && filtered.length > 0 && (
            <footer className="flex shrink-0 items-center justify-between border-t border-line px-5 py-3 text-sm text-dim">
              <span>
                Showing{" "}
                <span className="font-medium text-fg tnum">
                  {current * PAGE_SIZE + 1}–{Math.min(filtered.length, (current + 1) * PAGE_SIZE)}
                </span>{" "}
                of <span className="tnum">{filtered.length}</span>
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="lg"
                  disabled={current === 0}
                  onClick={() => setPage(current - 1)}
                  aria-label="Previous page"
                >
                  <ChevronLeft className="rtl:rotate-180" /> Prev
                </Button>
                <span className="px-2 tnum">
                  {current + 1} / {pages}
                </span>
                <Button
                  variant="outline"
                  size="lg"
                  disabled={current >= pages - 1}
                  onClick={() => setPage(current + 1)}
                  aria-label="Next page"
                >
                  Next <ChevronRight className="rtl:rotate-180" />
                </Button>
              </div>
            </footer>
          )}
        </div>
      </div>
    </div>
  );
}

export function TicketsPage() {
  return (
    <AppShell>
      <Body />
    </AppShell>
  );
}
