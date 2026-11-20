"use client";

import {
  ChartColumn,
  HardHat,
  Languages,
  LayoutDashboard,
  Phone,
  Settings,
  Siren,
  Ticket,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { toast } from "sonner";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { CATEGORY_META } from "@/lib/domain";
import { Bi, useLang } from "@/lib/i18n";
import { onLiveEvent, useLive, useLiveData } from "@/lib/store";
import { cn } from "@/lib/utils";
import { LogoMark } from "./logo";
import { TicketDrawer } from "./ticket-drawer";

const NAV: { href: string; en: string; ur: string; icon: LucideIcon; external?: boolean }[] = [
  { href: "/", en: "Command Center", ur: "کمانڈ سینٹر", icon: LayoutDashboard },
  { href: "/tickets", en: "Tickets", ur: "شکایات", icon: Ticket },
  { href: "/incidents", en: "Incidents", ur: "واقعات", icon: Siren },
  { href: "/analytics", en: "Analytics", ur: "تجزیات", icon: ChartColumn },
  { href: "/officer", en: "Officer app", ur: "افسر ایپ", icon: HardHat, external: true },
  { href: "/call", en: "Citizen call page", ur: "شہری کال", icon: Phone, external: true },
];

function RailLink({
  href,
  en,
  ur,
  icon: Icon,
  active,
  external,
  badge,
}: {
  href: string;
  en: string;
  ur: string;
  icon: LucideIcon;
  active: boolean;
  external?: boolean;
  badge?: number;
}) {
  const { isUr } = useLang();
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Link
            href={href}
            target={external ? "_blank" : undefined}
            aria-label={en}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative grid size-11 place-items-center rounded-xl border transition-colors duration-200",
              active
                ? "border-live/40 bg-live/15 text-live"
                : "border-transparent text-dim hover:border-line hover:bg-panel-2 hover:text-fg",
            )}
          />
        }
      >
        <Icon className="size-5" />
        {badge ? (
          <span className="absolute -top-1 -end-1 grid min-w-4.5 place-items-center rounded-full bg-danger px-1 text-[10px] leading-4.5 font-semibold text-white tnum">
            {badge}
          </span>
        ) : null}
      </TooltipTrigger>
      <TooltipContent side={isUr ? "left" : "right"} sideOffset={10}>
        <Bi en={en} ur={ur} secondaryClassName="text-ink/60" />
      </TooltipContent>
    </Tooltip>
  );
}

function Rail() {
  const pathname = usePathname();
  const { lang, toggle } = useLang();
  const activeIncidents = useLive((s) => s.incidents.filter((i) => i.status === "active").length);
  return (
    <nav
      aria-label="Main"
      className="flex w-[68px] shrink-0 flex-col items-center gap-2 border-e border-line bg-[#0d1526] py-4"
    >
      <Link href="/" aria-label="Faryad home" className="mb-3">
        <LogoMark className="size-10" />
      </Link>
      {NAV.map((item) => (
        <RailLink
          key={item.href}
          {...item}
          active={item.href === "/" ? pathname === "/" : pathname.startsWith(item.href)}
          badge={item.href === "/incidents" ? activeIncidents : undefined}
        />
      ))}
      <div className="mt-auto flex flex-col items-center gap-2">
        <Tooltip>
          <TooltipTrigger
            render={
              <button
                type="button"
                onClick={toggle}
                aria-label="Switch language"
                className="grid size-11 place-items-center rounded-xl border border-transparent text-dim transition-colors duration-200 hover:border-line hover:bg-panel-2 hover:text-fg"
              />
            }
          >
            <span className="flex flex-col items-center gap-0.5">
              <Languages className="size-4.5" />
              <span className="text-[10px] leading-none font-semibold">{lang === "ur" ? "EN" : "اردو"}</span>
            </span>
          </TooltipTrigger>
          <TooltipContent side={lang === "ur" ? "left" : "right"} sideOffset={10}>
            {lang === "ur" ? "Switch to English" : "اردو میں دیکھیں"}
          </TooltipContent>
        </Tooltip>
        <RailLink
          href="/settings"
          en="Settings"
          ur="ترتیبات"
          icon={Settings}
          active={pathname.startsWith("/settings")}
        />
      </div>
    </nav>
  );
}

/** Stage alerts: a caller who needs a human, and a new incident. */
function useLiveAlerts() {
  const router = useRouter();
  useEffect(
    () =>
      onLiveEvent((event) => {
        if (event.type === "call.human_needed") {
          toast.error("Human officer needed · انسانی افسر درکار ہے", {
            description: `${event.payload.phoneMasked ?? "Caller"} — ${event.payload.reason}`,
            duration: 14_000,
            className: "!border-danger/60 !bg-[#2a0f14]",
          });
        } else if (event.type === "incident.created") {
          const i = event.payload;
          toast.warning(`Incident detected · ${CATEGORY_META[i.category].en} · ${i.areaEn}`, {
            description: i.summary,
            duration: 12_000,
            className: "!border-danger/60 !bg-[#2a0f14]",
            action: { label: "View", onClick: () => router.push(`/incidents?focus=${i.id}`) },
          });
        }
      }),
    [router],
  );
}

/** Frame for the desk screens: nav rail on the side, shared ticket drawer, live alerts. */
export function AppShell({ children }: { children: React.ReactNode }) {
  useLiveData();
  useLiveAlerts();
  return (
    <div className="flex h-dvh w-full overflow-hidden bg-ink">
      <Rail />
      <main className="min-w-0 flex-1">{children}</main>
      <TicketDrawer />
    </div>
  );
}

export function PageHeader({
  en,
  ur,
  hint,
  children,
}: {
  en: string;
  ur: string;
  hint?: string;
  children?: React.ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4 border-b border-line px-8 pt-7 pb-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-fg">
          <Bi en={en} ur={ur} secondaryClassName="text-lg" />
        </h1>
        {hint && <p className="mt-1 text-sm text-dim">{hint}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </header>
  );
}
