import { z } from "zod";
import { pgTable, text, varchar, integer, boolean, doublePrecision, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

// Database Tables
export const usersTable = pgTable("users", {
  id: varchar("id", { length: 36 }).primaryKey(),
  username: varchar("username", { length: 255 }).notNull().unique(),
  password: text("password").notNull(),
  role: varchar("role", { length: 20 }).notNull().default("user"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const recordsTable = pgTable("records", {
  id: varchar("id", { length: 36 }).primaryKey(),
  categoriaCompenso: varchar("categoria_compenso", { length: 10 }).notNull().default("card"),
  data: varchar("data", { length: 50 }),
  operatore: varchar("operatore", { length: 255 }).notNull(),
  paziente: varchar("paziente", { length: 255 }).notNull(),
  prestazione: text("prestazione").notNull(),
  elementiDentali: text("elementi_dentali").notNull(),
  prezzoAlPaziente: doublePrecision("prezzo_al_paziente").notNull(),
  compensoOperatore: doublePrecision("compenso_operatore").notNull(),
  hasAnomaly: boolean("has_anomaly").notNull().default(false),
});

export const mappingsTable = pgTable("mappings", {
  id: varchar("id", { length: 36 }).primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  mappings: jsonb("mappings").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const analysesTable = pgTable("analyses", {
  id: varchar("id", { length: 36 }).primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  dateRange: varchar("date_range", { length: 255 }).notNull(),
  records: jsonb("records").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const paymentStatusTable = pgTable("payment_status", {
  operatore: varchar("operatore", { length: 255 }).primaryKey(),
  paidA: boolean("paid_a").notNull().default(false),
  paidB: boolean("paid_b").notNull().default(false),
});

export const categoriaCompensoEnum = z.enum(["card", "cash"]);
export type CategoriaCompenso = z.infer<typeof categoriaCompensoEnum>;

export const compensoRecordSchema = z.object({
  id: z.string(),
  categoriaCompenso: categoriaCompensoEnum.default("card"),
  data: z.string().optional(),
  operatore: z.string(),
  paziente: z.string(),
  prestazione: z.string(),
  elementiDentali: z.string(),
  prezzoAlPaziente: z.number(),
  compensoOperatore: z.number(),
  hasAnomaly: z.boolean().default(false),
});

export type CompensoRecord = z.infer<typeof compensoRecordSchema>;

export const insertCompensoRecordSchema = compensoRecordSchema.omit({ id: true, hasAnomaly: true });
export type InsertCompensoRecord = z.infer<typeof insertCompensoRecordSchema>;

export const analysisSchema = z.object({
  id: z.string(),
  name: z.string(),
  dateRange: z.string(),
  createdAt: z.string(),
  records: z.array(compensoRecordSchema),
});

export type Analysis = z.infer<typeof analysisSchema>;

export const insertAnalysisSchema = analysisSchema.omit({ id: true, createdAt: true });
export type InsertAnalysis = z.infer<typeof insertAnalysisSchema>;

export const columnMappingSchema = z.object({
  id: z.string(),
  name: z.string(),
  mappings: z.record(z.string(), z.string()),
  createdAt: z.string(),
});

export type ColumnMapping = z.infer<typeof columnMappingSchema>;

export const insertColumnMappingSchema = columnMappingSchema.omit({ id: true, createdAt: true });
export type InsertColumnMapping = z.infer<typeof insertColumnMappingSchema>;

export const operatorReportSchema = z.object({
  operatore: z.string(),
  compensoTotale: z.number(),
  compensoCard: z.number(),
  compensoCash: z.number(),
  compensoTotaleArrotondato: z.number(),
  compensoCardArrotondato: z.number(),
  compensoCashArrotondato: z.number(),
  numeroAnomalie: z.number(),
  numeroRecord: z.number(),
});

export type OperatorReport = z.infer<typeof operatorReportSchema>;

export const appFieldNames = [
  "data",
  "operatore",
  "paziente", 
  "prestazione",
  "elementiDentali",
  "prezzoAlPaziente",
  "compensoOperatore",
] as const;

export type AppFieldName = typeof appFieldNames[number];

export const appFieldLabels: Record<AppFieldName, string> = {
  data: "Data",
  operatore: "Operatore",
  paziente: "Paziente",
  prestazione: "Prestazione",
  elementiDentali: "Elementi Dentali",
  prezzoAlPaziente: "Prezzo al Paziente",
  compensoOperatore: "Compenso Operatore",
};

export const userRoleEnum = z.enum(["admin", "user"]);
export type UserRole = z.infer<typeof userRoleEnum>;

export const userSchema = z.object({
  id: z.string(),
  username: z.string(),
  password: z.string(),
  role: userRoleEnum.default("user"),
  createdAt: z.string(),
});

export type User = z.infer<typeof userSchema>;

export const insertUserSchema = userSchema.omit({ id: true, createdAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;

export const loginSchema = z.object({
  username: z.string().min(1, "Username richiesto"),
  password: z.string().min(1, "Password richiesta"),
});

export type LoginCredentials = z.infer<typeof loginSchema>;

export const publicUserSchema = userSchema.omit({ password: true });
export type PublicUser = z.infer<typeof publicUserSchema>;

export const operatorPaymentStatusSchema = z.object({
  operatore: z.string(),
  paidA: z.boolean().default(false),
  paidB: z.boolean().default(false),
});

export type OperatorPaymentStatus = z.infer<typeof operatorPaymentStatusSchema>;
