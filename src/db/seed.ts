import type Database from "better-sqlite3";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { startOfTodayPK, ticketNoSpokenUr } from "@/lib/format";
import type { TranscriptLine } from "@/lib/domain";
import { priorityFor, slaHoursFor } from "@/server/rules";
import * as schema from "./schema";
import { OFFICER_NAMES, SEED_AREAS, SEED_DEPARTMENTS, SEED_TICKETS } from "./seed-data";

export type Store = {
  sqlite: Database.Database;
  db: BetterSQLite3Database<typeof schema>;
};

/** Small deterministic generator so every reseed lays the pins out the same way. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

/** Wipes the operational tables and loads the demo dataset. Settings are kept. */
export function seedDatabase(store: Store, now = Date.now()): { tickets: number; calls: number } {
  const { sqlite, db } = store;
  const rand = rng(20261121);
  const MIN = 60_000;

  // Keep everything inside "today" (Pakistan time) when the day is still young.
  const maxAgo = Math.max(...SEED_TICKETS.map((t) => t.minutesAgo)) + 20;
  const minutesToday = Math.floor((now - startOfTodayPK(now)) / MIN);
  const scale = minutesToday < maxAgo ? Math.max(0.05, minutesToday / maxAgo) : 1;

  let ticketCount = 0;
  let callCount = 0;

  const run = sqlite.transaction(() => {
    for (const table of schema.ALL_TABLES) sqlite.prepare(`DELETE FROM ${table}`).run();
    sqlite
      .prepare(
        `DELETE FROM sqlite_sequence WHERE name IN (${schema.ALL_TABLES.map(() => "?").join(",")})`,
      )
      .run(...schema.ALL_TABLES);

    db.insert(schema.areas).values(SEED_AREAS).run();
    db.insert(schema.departments).values(SEED_DEPARTMENTS).run();

    const areaRows = db.select().from(schema.areas).all();
    const deptRows = db.select().from(schema.departments).all();
    const areaByName = new Map(areaRows.map((a) => [a.nameEn, a]));

    const ordered = [...SEED_TICKETS].sort((a, b) => b.minutesAgo - a.minutesAgo);

    ordered.forEach((t, i) => {
      const area = areaByName.get(t.area);
      if (!area) throw new Error(`Seed ticket refers to unknown area "${t.area}"`);
      const dept = deptRows.find((d) => d.categories.includes(t.category));
      const ageMs = Math.round(t.minutesAgo * scale * MIN);
      const createdAt = now - ageMs;
      const slaHours = slaHoursFor(dept, t.category);
      const ticketNo = `FRD-${1001 + i}`;
      const officers = OFFICER_NAMES[dept?.code ?? "WSSP"];
      const officer = officers[Math.floor(rand() * officers.length)];
      // Spread pins a few hundred metres around the area centre so they do not stack.
      const lat = area.lat + (rand() - 0.5) * 0.009;
      const lng = area.lng + (rand() - 0.5) * 0.011;

      const before = (target: number) => Math.min(target, now - 30_000);
      const assignedAt = before(createdAt + Math.round((4 + rand() * 5) * scale * MIN));
      const startedAt = before(createdAt + Math.round((16 + rand() * 14) * scale * MIN));
      const resolvedAt =
        t.status === "resolved"
          ? before(createdAt + Math.round(Math.min(t.minutesAgo - 8, 60 + rand() * 90) * scale * MIN))
          : null;
      const updatedAt =
        t.status === "resolved"
          ? (resolvedAt as number)
          : t.status === "in_progress"
            ? startedAt
            : t.status === "assigned"
              ? assignedAt
              : createdAt;

      const seconds = 70 + Math.floor(rand() * 115);
      const callId = `seed-${String(i + 1).padStart(3, "0")}`;
      const costUsd = Number(((seconds / 60) * (0.11 + rand() * 0.05)).toFixed(4));
      const callStart = createdAt - seconds * 1000;
      const step = (seconds * 1000) / 8;
      const transcript: TranscriptLine[] = [
        { role: "agent", text: "السلام علیکم، فریاد ہیلپ لائن، میں آپ کی کیا مدد کر سکتی ہوں؟", ts: callStart + 1500 },
        { role: "caller", text: t.ur, ts: callStart + step },
        { role: "agent", text: "جی، مجھے افسوس ہے۔ یہ مسئلہ کس علاقے میں ہے؟", ts: callStart + step * 2 },
        { role: "caller", text: `${area.nameUr} میں۔`, ts: callStart + step * 3 },
        { role: "agent", text: "شکریہ۔ براہِ کرم اپنا نام اور فون نمبر بتا دیں۔", ts: callStart + step * 4 },
        { role: "caller", text: `میرا نام ${t.name} ہے اور نمبر ${t.phone} ہے۔`, ts: callStart + step * 5 },
        { role: "agent", text: `آپ کی شکایت درج ہو گئی ہے۔ آپ کا شکایت نمبر ہے: ${ticketNoSpokenUr(ticketNo)}۔ یہ ${slaHours} گھنٹوں میں حل کر دی جائے گی۔`, ts: callStart + step * 6.5 },
        { role: "caller", text: "بہت شکریہ۔", ts: callStart + step * 7.5 },
      ];

      const inserted = db
        .insert(schema.tickets)
        .values({
          ticketNo,
          callerName: t.name,
          phone: t.phone,
          category: t.category,
          areaId: area.id,
          lat,
          lng,
          locationSource: "area",
          addressNote: null,
          descriptionUr: t.ur,
          descriptionEn: t.en,
          status: t.status,
          priority: priorityFor(t.category, t.mood),
          departmentId: dept?.id ?? null,
          incidentId: null,
          mood: t.mood,
          slaDueAt: createdAt + slaHours * 3_600_000,
          createdAt,
          updatedAt,
          resolvedAt,
          resolutionNote: t.status === "resolved" ? (t.note ?? "Resolved on site.") : null,
          voiceNoteUrl: null,
          callId,
          assignee: t.status === "open" ? null : officer,
        })
        .returning({ id: schema.tickets.id })
        .get();
      ticketCount++;

      const events: (typeof schema.ticketEvents.$inferInsert)[] = [
        {
          ticketId: inserted.id,
          type: "created",
          text: `Complaint registered from a voice call and routed to ${dept?.code ?? "department"}.`,
          actor: "Faryad AI",
          createdAt,
        },
      ];
      if (t.status !== "open") {
        events.push({
          ticketId: inserted.id,
          type: "assigned",
          text: `Assigned to ${officer}.`,
          actor: officer,
          createdAt: assignedAt,
        });
      }
      if (t.status === "in_progress" || t.status === "resolved") {
        events.push({
          ticketId: inserted.id,
          type: "status_changed",
          text: "Work started on site.",
          actor: officer,
          createdAt: Math.max(assignedAt + 1000, startedAt),
        });
      }
      if (t.status === "resolved" && resolvedAt) {
        const at = Math.max(startedAt + 2000, resolvedAt);
        events.push(
          {
            ticketId: inserted.id,
            type: "status_changed",
            text: `Resolved. ${t.note ?? ""}`.trim(),
            actor: officer,
            createdAt: at,
          },
          {
            ticketId: inserted.id,
            type: "voice_note_sent",
            text: "Urdu voice note sent to the citizen.",
            actor: "Faryad AI",
            createdAt: at + 3000,
          },
        );
      }
      db.insert(schema.ticketEvents).values(events).run();

      db.insert(schema.calls)
        .values({
          id: callId,
          startedAt: callStart,
          endedAt: createdAt + 6000,
          seconds,
          transcript,
          ticketId: inserted.id,
          costUsd,
          costPkr: Number((costUsd * 280).toFixed(2)),
          fields: {
            name: t.name,
            phone: t.phone,
            area: area.nameEn,
            category: t.category,
            description: t.en,
            mood: t.mood,
          },
          lat: null,
          lng: null,
          simulated: false,
        })
        .run();
      callCount++;
    });

    // A few short "where is my complaint?" calls, so call volume is not 1:1 with tickets.
    const statusCalls = [300, 215, 170, 125, 80, 52, 18];
    statusCalls.forEach((minutesAgo, i) => {
      const seconds = 28 + Math.floor(rand() * 30);
      const startedAt = now - Math.round(minutesAgo * scale * MIN);
      const ref = `FRD-${1003 + i * 3}`;
      const costUsd = Number(((seconds / 60) * 0.12).toFixed(4));
      db.insert(schema.calls)
        .values({
          id: `seed-status-${i + 1}`,
          startedAt,
          endedAt: startedAt + seconds * 1000,
          seconds,
          transcript: [
            { role: "agent", text: "السلام علیکم، فریاد ہیلپ لائن، میں آپ کی کیا مدد کر سکتی ہوں؟", ts: startedAt + 1500 },
            { role: "caller", text: `میری شکایت نمبر ${ref} کا کیا بنا؟`, ts: startedAt + 7000 },
            { role: "agent", text: "جی، آپ کی شکایت متعلقہ محکمے کے پاس ہے اور اس پر کام جاری ہے۔", ts: startedAt + 14000 },
            { role: "caller", text: "ٹھیک ہے، شکریہ۔", ts: startedAt + 20000 },
          ],
          ticketId: null,
          costUsd,
          costPkr: Number((costUsd * 280).toFixed(2)),
          fields: {},
          lat: null,
          lng: null,
          simulated: false,
        })
        .run();
      callCount++;
    });
  });

  run();
  return { tickets: ticketCount, calls: callCount };
}
