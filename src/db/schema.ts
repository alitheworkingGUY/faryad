import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";
import type { CallFields, Category, TranscriptLine } from "@/lib/domain";

export const areas = sqliteTable("areas", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  nameEn: text("name_en").notNull(),
  nameUr: text("name_ur").notNull(),
  lat: real("lat").notNull(),
  lng: real("lng").notNull(),
  // Other spellings a caller (or the transcriber) may use for this area.
  aliases: text("aliases", { mode: "json" }).$type<string[]>().notNull(),
});

export const departments = sqliteTable("departments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  nameUr: text("name_ur").notNull(),
  categories: text("categories", { mode: "json" }).$type<Category[]>().notNull(),
  slaHours: integer("sla_hours").notNull(),
  slaByCategory: text("sla_by_category", { mode: "json" })
    .$type<Partial<Record<Category, number>>>()
    .notNull(),
});

export const incidents = sqliteTable("incidents", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  category: text("category").$type<Category>().notNull(),
  areaId: integer("area_id").notNull(),
  ticketCount: integer("ticket_count").notNull(),
  summary: text("summary").notNull(),
  summaryUr: text("summary_ur").notNull(),
  escalationLevel: integer("escalation_level").notNull(),
  status: text("status").$type<"active" | "resolved">().notNull(),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const tickets = sqliteTable("tickets", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  ticketNo: text("ticket_no").notNull().unique(),
  callerName: text("caller_name").notNull(),
  phone: text("phone").notNull(),
  category: text("category").$type<Category>().notNull(),
  areaId: integer("area_id"),
  lat: real("lat").notNull(),
  lng: real("lng").notNull(),
  locationSource: text("location_source").$type<"area" | "gps" | "manual">().notNull(),
  addressNote: text("address_note"),
  descriptionUr: text("description_ur").notNull(),
  descriptionEn: text("description_en").notNull(),
  status: text("status").$type<"open" | "assigned" | "in_progress" | "resolved">().notNull(),
  priority: text("priority").$type<"low" | "normal" | "high" | "urgent">().notNull(),
  departmentId: integer("department_id"),
  incidentId: integer("incident_id"),
  mood: integer("mood").notNull(),
  slaDueAt: integer("sla_due_at").notNull(),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
  resolvedAt: integer("resolved_at"),
  resolutionNote: text("resolution_note"),
  voiceNoteUrl: text("voice_note_url"),
  callId: text("call_id"),
  assignee: text("assignee"),
});

export const ticketEvents = sqliteTable("ticket_events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  ticketId: integer("ticket_id").notNull(),
  type: text("type")
    .$type<"created" | "assigned" | "status_changed" | "note" | "voice_note_sent">()
    .notNull(),
  text: text("text").notNull(),
  actor: text("actor").notNull(),
  createdAt: integer("created_at").notNull(),
});

export const calls = sqliteTable("calls", {
  id: text("id").primaryKey(),
  startedAt: integer("started_at").notNull(),
  endedAt: integer("ended_at"),
  seconds: integer("seconds").notNull(),
  transcript: text("transcript", { mode: "json" }).$type<TranscriptLine[]>().notNull(),
  ticketId: integer("ticket_id"),
  costUsd: real("cost_usd").notNull(),
  costPkr: real("cost_pkr").notNull(),
  // Live "extracted details" card + GPS shared by the caller on this call.
  fields: text("fields", { mode: "json" }).$type<CallFields>().notNull(),
  lat: real("lat"),
  lng: real("lng"),
  simulated: integer("simulated", { mode: "boolean" }).notNull(),
});

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export type AreaRow = typeof areas.$inferSelect;
export type DepartmentRow = typeof departments.$inferSelect;
export type TicketRow = typeof tickets.$inferSelect;
export type TicketEventRow = typeof ticketEvents.$inferSelect;
export type IncidentRow = typeof incidents.$inferSelect;
export type CallRow = typeof calls.$inferSelect;

/** Kept in step with the tables above; run on every connection open. */
export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS areas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name_en TEXT NOT NULL,
  name_ur TEXT NOT NULL,
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  aliases TEXT NOT NULL DEFAULT '[]'
);
CREATE TABLE IF NOT EXISTS departments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  name_ur TEXT NOT NULL,
  categories TEXT NOT NULL,
  sla_hours INTEGER NOT NULL,
  sla_by_category TEXT NOT NULL DEFAULT '{}'
);
CREATE TABLE IF NOT EXISTS incidents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category TEXT NOT NULL,
  area_id INTEGER NOT NULL,
  ticket_count INTEGER NOT NULL,
  summary TEXT NOT NULL,
  summary_ur TEXT NOT NULL,
  escalation_level INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS tickets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket_no TEXT NOT NULL UNIQUE,
  caller_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  category TEXT NOT NULL,
  area_id INTEGER,
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  location_source TEXT NOT NULL DEFAULT 'area',
  address_note TEXT,
  description_ur TEXT NOT NULL,
  description_en TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  priority TEXT NOT NULL DEFAULT 'normal',
  department_id INTEGER,
  incident_id INTEGER,
  mood INTEGER NOT NULL DEFAULT 3,
  sla_due_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  resolved_at INTEGER,
  resolution_note TEXT,
  voice_note_url TEXT,
  call_id TEXT,
  assignee TEXT
);
CREATE INDEX IF NOT EXISTS tickets_created_idx ON tickets (created_at);
CREATE INDEX IF NOT EXISTS tickets_cluster_idx ON tickets (category, area_id, created_at);
CREATE TABLE IF NOT EXISTS ticket_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket_id INTEGER NOT NULL,
  type TEXT NOT NULL,
  text TEXT NOT NULL,
  actor TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS ticket_events_ticket_idx ON ticket_events (ticket_id, created_at);
CREATE TABLE IF NOT EXISTS calls (
  id TEXT PRIMARY KEY,
  started_at INTEGER NOT NULL,
  ended_at INTEGER,
  seconds INTEGER NOT NULL DEFAULT 0,
  transcript TEXT NOT NULL DEFAULT '[]',
  ticket_id INTEGER,
  cost_usd REAL NOT NULL DEFAULT 0,
  cost_pkr REAL NOT NULL DEFAULT 0,
  fields TEXT NOT NULL DEFAULT '{}',
  lat REAL,
  lng REAL,
  simulated INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;

export const ALL_TABLES = [
  "ticket_events",
  "tickets",
  "incidents",
  "calls",
  "departments",
  "areas",
] as const;
