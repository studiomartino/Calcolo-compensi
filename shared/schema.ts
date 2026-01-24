import { z } from "zod";

export const categoriaCompensoEnum = z.enum(["card", "cash"]);
export type CategoriaCompenso = z.infer<typeof categoriaCompensoEnum>;

export const compensoRecordSchema = z.object({
  id: z.string(),
  categoriaCompenso: categoriaCompensoEnum.default("card"),
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
  "operatore",
  "paziente", 
  "prestazione",
  "elementiDentali",
  "prezzoAlPaziente",
  "compensoOperatore",
] as const;

export type AppFieldName = typeof appFieldNames[number];

export const appFieldLabels: Record<AppFieldName, string> = {
  operatore: "Operatore",
  paziente: "Paziente",
  prestazione: "Prestazione",
  elementiDentali: "Elementi Dentali",
  prezzoAlPaziente: "Prezzo al Paziente",
  compensoOperatore: "Compenso Operatore",
};

export const users = {
  id: "",
  username: "",
  password: "",
};

export type InsertUser = { username: string; password: string };
export type User = { id: string; username: string; password: string };
