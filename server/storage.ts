import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import { eq, desc, ilike } from "drizzle-orm";
import { db } from "./db";
import { 
  usersTable, 
  recordsTable, 
  mappingsTable, 
  analysesTable, 
  operatorsTable,
  operatorAliasesTable,
  paymentStatusTable,
  pagamentoGiornataModesTable,
  type CompensoRecord, 
  type InsertCompensoRecord, 
  type ColumnMapping, 
  type InsertColumnMapping, 
  type Analysis, 
  type InsertAnalysis, 
  type User, 
  type InsertUser, 
  type PublicUser, 
  type OperatorPaymentStatus,
  type Operator,
  type InsertOperator,
  type PagamentoGiornataMode,
  type OperatorAlias
} from "@shared/schema";

export interface IStorage {
  getRecords(): Promise<CompensoRecord[]>;
  getRecord(id: string): Promise<CompensoRecord | undefined>;
  createRecord(record: InsertCompensoRecord): Promise<CompensoRecord>;
  createRecords(records: InsertCompensoRecord[]): Promise<CompensoRecord[]>;
  updateRecord(id: string, updates: Partial<CompensoRecord>): Promise<CompensoRecord | undefined>;
  updateRecords(ids: string[], updates: Partial<CompensoRecord>): Promise<CompensoRecord[]>;
  deleteRecord(id: string): Promise<boolean>;
  clearRecords(): Promise<void>;
  
  getMappings(): Promise<ColumnMapping[]>;
  getMapping(id: string): Promise<ColumnMapping | undefined>;
  createMapping(mapping: InsertColumnMapping): Promise<ColumnMapping>;
  deleteMapping(id: string): Promise<boolean>;

  getAnalyses(): Promise<Analysis[]>;
  getAnalysis(id: string): Promise<Analysis | undefined>;
  createAnalysis(analysis: InsertAnalysis): Promise<Analysis>;
  updateAnalysisName(id: string, name: string): Promise<Analysis | undefined>;
  deleteAnalysis(id: string): Promise<boolean>;

  getUsers(): Promise<PublicUser[]>;
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<PublicUser>;
  updateUserPassword(id: string, newPassword: string): Promise<boolean>;
  deleteUser(id: string): Promise<boolean>;
  validateUser(username: string, password: string): Promise<User | null>;

  getOperators(): Promise<Operator[]>;
  getOperator(id: string): Promise<Operator | undefined>;
  createOperator(operator: InsertOperator): Promise<Operator>;
  updateOperator(id: string, updates: Partial<Operator>): Promise<Operator | undefined>;
  deleteOperator(id: string): Promise<boolean>;

  getPaymentStatus(): Promise<OperatorPaymentStatus[]>;
  updatePaymentStatus(operatore: string, field: 'paidA' | 'paidB', value: boolean): Promise<OperatorPaymentStatus>;
  clearPaymentStatus(): Promise<void>;

  getGiornataModes(analysisId: string, operatorName: string): Promise<PagamentoGiornataMode[]>;
  upsertGiornataMode(data: { analysisId: string; operatorName: string; workDate: string; mode: string }): Promise<PagamentoGiornataMode>;

  getOperatorAliases(): Promise<OperatorAlias[]>;
  createOperatorAlias(operatorId: string, alias: string): Promise<OperatorAlias>;
  deleteOperatorAlias(id: string): Promise<boolean>;
  
  initializeDatabase(): Promise<void>;
}

class DatabaseStorage implements IStorage {
  private checkAnomaly(prezzoAlPaziente: number, compensoOperatore: number): boolean {
    if (prezzoAlPaziente === 0 && compensoOperatore === 0) {
      return false;
    }
    return Math.abs(prezzoAlPaziente - compensoOperatore) < 0.02;
  }

  async initializeDatabase(): Promise<void> {
    await this.ensureAdminUser();
  }

  private async ensureAdminUser(): Promise<void> {
    const existingAdmin = await db.select().from(usersTable).where(eq(usersTable.username, "admin")).limit(1);
    if (existingAdmin.length === 0) {
      const hashedPassword = await bcrypt.hash("CalcoloCompensi2026!!", 10);
      await db.insert(usersTable).values({
        id: randomUUID(),
        username: "admin",
        password: hashedPassword,
        role: "admin",
      });
      console.log("Admin user created in database");
    }
  }

  async getRecords(): Promise<CompensoRecord[]> {
    const rows = await db.select().from(recordsTable);
    return rows.map(r => ({
      id: r.id,
      categoriaCompenso: r.categoriaCompenso as "card" | "cash",
      data: r.data || undefined,
      operatore: r.operatore,
      paziente: r.paziente,
      prestazione: r.prestazione,
      elementiDentali: r.elementiDentali,
      prezzoAlPaziente: r.prezzoAlPaziente,
      compensoOperatore: r.compensoOperatore,
      hasAnomaly: r.hasAnomaly,
    }));
  }

  async getRecord(id: string): Promise<CompensoRecord | undefined> {
    const rows = await db.select().from(recordsTable).where(eq(recordsTable.id, id)).limit(1);
    if (rows.length === 0) return undefined;
    const r = rows[0];
    return {
      id: r.id,
      categoriaCompenso: r.categoriaCompenso as "card" | "cash",
      data: r.data || undefined,
      operatore: r.operatore,
      paziente: r.paziente,
      prestazione: r.prestazione,
      elementiDentali: r.elementiDentali,
      prezzoAlPaziente: r.prezzoAlPaziente,
      compensoOperatore: r.compensoOperatore,
      hasAnomaly: r.hasAnomaly,
    };
  }

  async createRecord(record: InsertCompensoRecord): Promise<CompensoRecord> {
    const id = randomUUID();
    const hasAnomaly = this.checkAnomaly(record.prezzoAlPaziente, record.compensoOperatore);
    
    await db.insert(recordsTable).values({
      id,
      categoriaCompenso: record.categoriaCompenso || "card",
      data: record.data || null,
      operatore: record.operatore,
      paziente: record.paziente,
      prestazione: record.prestazione,
      elementiDentali: record.elementiDentali,
      prezzoAlPaziente: record.prezzoAlPaziente,
      compensoOperatore: record.compensoOperatore,
      hasAnomaly,
    });

    return {
      id,
      categoriaCompenso: record.categoriaCompenso || "card",
      data: record.data,
      operatore: record.operatore,
      paziente: record.paziente,
      prestazione: record.prestazione,
      elementiDentali: record.elementiDentali,
      prezzoAlPaziente: record.prezzoAlPaziente,
      compensoOperatore: record.compensoOperatore,
      hasAnomaly,
    };
  }

  async createRecords(records: InsertCompensoRecord[]): Promise<CompensoRecord[]> {
    const createdRecords: CompensoRecord[] = [];
    
    for (const record of records) {
      const id = randomUUID();
      const hasAnomaly = this.checkAnomaly(record.prezzoAlPaziente, record.compensoOperatore);
      
      await db.insert(recordsTable).values({
        id,
        categoriaCompenso: record.categoriaCompenso || "card",
        data: record.data || null,
        operatore: record.operatore,
        paziente: record.paziente,
        prestazione: record.prestazione,
        elementiDentali: record.elementiDentali,
        prezzoAlPaziente: record.prezzoAlPaziente,
        compensoOperatore: record.compensoOperatore,
        hasAnomaly,
      });

      createdRecords.push({
        id,
        categoriaCompenso: record.categoriaCompenso || "card",
        data: record.data,
        operatore: record.operatore,
        paziente: record.paziente,
        prestazione: record.prestazione,
        elementiDentali: record.elementiDentali,
        prezzoAlPaziente: record.prezzoAlPaziente,
        compensoOperatore: record.compensoOperatore,
        hasAnomaly,
      });
    }
    
    return createdRecords;
  }

  async updateRecord(id: string, updates: Partial<CompensoRecord>): Promise<CompensoRecord | undefined> {
    const existing = await this.getRecord(id);
    if (!existing) return undefined;

    const updatedRecord = { ...existing, ...updates };
    
    if ('prezzoAlPaziente' in updates || 'compensoOperatore' in updates) {
      updatedRecord.hasAnomaly = this.checkAnomaly(
        updatedRecord.prezzoAlPaziente,
        updatedRecord.compensoOperatore
      );
    }

    await db.update(recordsTable).set({
      categoriaCompenso: updatedRecord.categoriaCompenso,
      data: updatedRecord.data || null,
      operatore: updatedRecord.operatore,
      paziente: updatedRecord.paziente,
      prestazione: updatedRecord.prestazione,
      elementiDentali: updatedRecord.elementiDentali,
      prezzoAlPaziente: updatedRecord.prezzoAlPaziente,
      compensoOperatore: updatedRecord.compensoOperatore,
      hasAnomaly: updatedRecord.hasAnomaly,
    }).where(eq(recordsTable.id, id));

    return updatedRecord;
  }

  async updateRecords(ids: string[], updates: Partial<CompensoRecord>): Promise<CompensoRecord[]> {
    const updatedRecords: CompensoRecord[] = [];
    for (const id of ids) {
      const updated = await this.updateRecord(id, updates);
      if (updated) updatedRecords.push(updated);
    }
    return updatedRecords;
  }

  async deleteRecord(id: string): Promise<boolean> {
    const result = await db.delete(recordsTable).where(eq(recordsTable.id, id));
    return true;
  }

  async clearRecords(): Promise<void> {
    await db.delete(recordsTable);
  }

  async getMappings(): Promise<ColumnMapping[]> {
    const rows = await db.select().from(mappingsTable);
    return rows.map(r => ({
      id: r.id,
      name: r.name,
      mappings: r.mappings as Record<string, string>,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  async getMapping(id: string): Promise<ColumnMapping | undefined> {
    const rows = await db.select().from(mappingsTable).where(eq(mappingsTable.id, id)).limit(1);
    if (rows.length === 0) return undefined;
    const r = rows[0];
    return {
      id: r.id,
      name: r.name,
      mappings: r.mappings as Record<string, string>,
      createdAt: r.createdAt.toISOString(),
    };
  }

  async createMapping(mapping: InsertColumnMapping): Promise<ColumnMapping> {
    const id = randomUUID();
    const createdAt = new Date();
    
    await db.insert(mappingsTable).values({
      id,
      name: mapping.name,
      mappings: mapping.mappings,
    });

    return {
      id,
      name: mapping.name,
      mappings: mapping.mappings,
      createdAt: createdAt.toISOString(),
    };
  }

  async deleteMapping(id: string): Promise<boolean> {
    await db.delete(mappingsTable).where(eq(mappingsTable.id, id));
    return true;
  }

  async getAnalyses(): Promise<Analysis[]> {
    const rows = await db.select().from(analysesTable).orderBy(desc(analysesTable.createdAt));
    return rows.map(r => ({
      id: r.id,
      name: r.name,
      dateRange: r.dateRange,
      records: r.records as CompensoRecord[],
      createdAt: r.createdAt.toISOString(),
    }));
  }

  async getAnalysis(id: string): Promise<Analysis | undefined> {
    const rows = await db.select().from(analysesTable).where(eq(analysesTable.id, id)).limit(1);
    if (rows.length === 0) return undefined;
    const r = rows[0];
    return {
      id: r.id,
      name: r.name,
      dateRange: r.dateRange,
      records: r.records as CompensoRecord[],
      createdAt: r.createdAt.toISOString(),
    };
  }

  async createAnalysis(analysis: InsertAnalysis): Promise<Analysis> {
    const id = randomUUID();
    const createdAt = new Date();
    
    await db.insert(analysesTable).values({
      id,
      name: analysis.name,
      dateRange: analysis.dateRange,
      records: analysis.records,
    });

    return {
      id,
      name: analysis.name,
      dateRange: analysis.dateRange,
      records: analysis.records,
      createdAt: createdAt.toISOString(),
    };
  }

  async updateAnalysisName(id: string, name: string): Promise<Analysis | undefined> {
    const rows = await db.select().from(analysesTable).where(eq(analysesTable.id, id)).limit(1);
    if (rows.length === 0) return undefined;
    await db.update(analysesTable).set({ name }).where(eq(analysesTable.id, id));
    const r = rows[0];
    return {
      id: r.id,
      name,
      dateRange: r.dateRange,
      records: r.records as CompensoRecord[],
      createdAt: r.createdAt.toISOString(),
    };
  }

  async deleteAnalysis(id: string): Promise<boolean> {
    await db.delete(analysesTable).where(eq(analysesTable.id, id));
    return true;
  }

  async getUsers(): Promise<PublicUser[]> {
    const rows = await db.select().from(usersTable);
    return rows.map(r => ({
      id: r.id,
      username: r.username,
      role: r.role as "admin" | "user",
      createdAt: r.createdAt.toISOString(),
    }));
  }

  async getUser(id: string): Promise<User | undefined> {
    const rows = await db.select().from(usersTable).where(eq(usersTable.id, id)).limit(1);
    if (rows.length === 0) return undefined;
    const r = rows[0];
    return {
      id: r.id,
      username: r.username,
      password: r.password,
      role: r.role as "admin" | "user",
      createdAt: r.createdAt.toISOString(),
    };
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const rows = await db.select().from(usersTable).where(ilike(usersTable.username, username)).limit(1);
    if (rows.length === 0) return undefined;
    const r = rows[0];
    return {
      id: r.id,
      username: r.username,
      password: r.password,
      role: r.role as "admin" | "user",
      createdAt: r.createdAt.toISOString(),
    };
  }

  async createUser(user: InsertUser): Promise<PublicUser> {
    const existingUser = await this.getUserByUsername(user.username);
    if (existingUser) {
      throw new Error("Username già esistente");
    }

    const id = randomUUID();
    const hashedPassword = await bcrypt.hash(user.password, 10);
    const createdAt = new Date();

    await db.insert(usersTable).values({
      id,
      username: user.username,
      password: hashedPassword,
      role: user.role || "user",
    });

    return {
      id,
      username: user.username,
      role: user.role || "user",
      createdAt: createdAt.toISOString(),
    };
  }

  async updateUserPassword(id: string, newPassword: string): Promise<boolean> {
    const user = await this.getUser(id);
    if (!user) return false;

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await db.update(usersTable).set({ password: hashedPassword }).where(eq(usersTable.id, id));
    return true;
  }

  async deleteUser(id: string): Promise<boolean> {
    const user = await this.getUser(id);
    if (!user) return false;
    
    if (user.role === "admin") {
      const allUsers = await this.getUsers();
      const adminCount = allUsers.filter(u => u.role === "admin").length;
      if (adminCount <= 1) {
        throw new Error("Impossibile eliminare l'ultimo amministratore");
      }
    }

    await db.delete(usersTable).where(eq(usersTable.id, id));
    return true;
  }

  async validateUser(username: string, password: string): Promise<User | null> {
    const user = await this.getUserByUsername(username);
    if (!user) return null;

    const isValid = await bcrypt.compare(password, user.password);
    return isValid ? user : null;
  }

  private mapOperatorRow(r: typeof operatorsTable.$inferSelect): Operator {
    return {
      id: r.id,
      name: r.name,
      pagamentoGiornataAttivo: r.pagamentoGiornataAttivo ?? false,
      pagamentoGiornataMinimoA: r.pagamentoGiornataMinimoA ?? null,
      pagamentoGiornataMinimoB: r.pagamentoGiornataMinimoB ?? null,
      pagamentoGiornataFissoA: r.pagamentoGiornataFissoA ?? null,
      pagamentoGiornataFissoB: r.pagamentoGiornataFissoB ?? null,
      createdAt: r.createdAt.toISOString(),
    };
  }

  async getOperators(): Promise<Operator[]> {
    const rows = await db.select().from(operatorsTable).orderBy(operatorsTable.name);
    return rows.map(r => this.mapOperatorRow(r));
  }

  async getOperator(id: string): Promise<Operator | undefined> {
    const rows = await db.select().from(operatorsTable).where(eq(operatorsTable.id, id)).limit(1);
    if (rows.length === 0) return undefined;
    return this.mapOperatorRow(rows[0]);
  }

  async createOperator(operator: InsertOperator): Promise<Operator> {
    const id = randomUUID();
    await db.insert(operatorsTable).values({ id, name: operator.name });
    const rows = await db.select().from(operatorsTable).where(eq(operatorsTable.id, id)).limit(1);
    return this.mapOperatorRow(rows[0]);
  }

  async updateOperator(id: string, updates: Partial<Operator>): Promise<Operator | undefined> {
    const existing = await this.getOperator(id);
    if (!existing) return undefined;
    const setValues: Record<string, any> = {};
    if (updates.name !== undefined) setValues.name = updates.name;
    if (updates.pagamentoGiornataAttivo !== undefined) setValues.pagamentoGiornataAttivo = updates.pagamentoGiornataAttivo;
    if (updates.pagamentoGiornataMinimoA !== undefined) setValues.pagamentoGiornataMinimoA = updates.pagamentoGiornataMinimoA;
    if (updates.pagamentoGiornataMinimoB !== undefined) setValues.pagamentoGiornataMinimoB = updates.pagamentoGiornataMinimoB;
    if (updates.pagamentoGiornataFissoA !== undefined) setValues.pagamentoGiornataFissoA = updates.pagamentoGiornataFissoA;
    if (updates.pagamentoGiornataFissoB !== undefined) setValues.pagamentoGiornataFissoB = updates.pagamentoGiornataFissoB;
    if (Object.keys(setValues).length > 0) {
      await db.update(operatorsTable).set(setValues).where(eq(operatorsTable.id, id));
    }
    const rows = await db.select().from(operatorsTable).where(eq(operatorsTable.id, id)).limit(1);
    return this.mapOperatorRow(rows[0]);
  }

  async deleteOperator(id: string): Promise<boolean> {
    const existing = await this.getOperator(id);
    if (!existing) return false;
    await db.delete(operatorsTable).where(eq(operatorsTable.id, id));
    return true;
  }

  async getGiornataModes(analysisId: string, operatorName: string): Promise<PagamentoGiornataMode[]> {
    const { and } = await import("drizzle-orm");
    const rows = await db.select().from(pagamentoGiornataModesTable).where(
      and(
        eq(pagamentoGiornataModesTable.analysisId, analysisId),
        eq(pagamentoGiornataModesTable.operatorName, operatorName)
      )
    );
    return rows.map(r => ({
      id: r.id,
      analysisId: r.analysisId,
      operatorName: r.operatorName,
      workDate: r.workDate,
      mode: r.mode as "minimo" | "fisso" | "none",
    }));
  }

  async upsertGiornataMode(data: { analysisId: string; operatorName: string; workDate: string; mode: string }): Promise<PagamentoGiornataMode> {
    const { and } = await import("drizzle-orm");
    const existing = await db.select().from(pagamentoGiornataModesTable).where(
      and(
        eq(pagamentoGiornataModesTable.analysisId, data.analysisId),
        eq(pagamentoGiornataModesTable.operatorName, data.operatorName),
        eq(pagamentoGiornataModesTable.workDate, data.workDate)
      )
    ).limit(1);

    if (existing.length > 0) {
      await db.update(pagamentoGiornataModesTable)
        .set({ mode: data.mode })
        .where(eq(pagamentoGiornataModesTable.id, existing[0].id));
      return {
        id: existing[0].id,
        analysisId: data.analysisId,
        operatorName: data.operatorName,
        workDate: data.workDate,
        mode: data.mode as "minimo" | "fisso" | "none",
      };
    }

    const id = randomUUID();
    await db.insert(pagamentoGiornataModesTable).values({
      id,
      analysisId: data.analysisId,
      operatorName: data.operatorName,
      workDate: data.workDate,
      mode: data.mode,
    });
    return {
      id,
      analysisId: data.analysisId,
      operatorName: data.operatorName,
      workDate: data.workDate,
      mode: data.mode as "minimo" | "fisso" | "none",
    };
  }

  async getOperatorAliases(): Promise<OperatorAlias[]> {
    const rows = await db.select().from(operatorAliasesTable);
    return rows.map(r => ({
      id: r.id,
      operatorId: r.operatorId,
      alias: r.alias,
    }));
  }

  async createOperatorAlias(operatorId: string, alias: string): Promise<OperatorAlias> {
    const id = randomUUID();
    const normalizedAlias = alias.toUpperCase();
    await db.insert(operatorAliasesTable).values({ id, operatorId, alias: normalizedAlias });
    return { id, operatorId, alias: normalizedAlias };
  }

  async deleteOperatorAlias(id: string): Promise<boolean> {
    await db.delete(operatorAliasesTable).where(eq(operatorAliasesTable.id, id));
    return true;
  }

  async getPaymentStatus(): Promise<OperatorPaymentStatus[]> {
    const rows = await db.select().from(paymentStatusTable);
    return rows.map(r => ({
      operatore: r.operatore,
      paidA: r.paidA,
      paidB: r.paidB,
    }));
  }

  async updatePaymentStatus(operatore: string, field: 'paidA' | 'paidB', value: boolean): Promise<OperatorPaymentStatus> {
    const existing = await db.select().from(paymentStatusTable).where(eq(paymentStatusTable.operatore, operatore)).limit(1);
    
    if (existing.length === 0) {
      const newStatus = { operatore, paidA: false, paidB: false, [field]: value };
      await db.insert(paymentStatusTable).values(newStatus);
      return newStatus;
    }

    await db.update(paymentStatusTable).set({ [field]: value }).where(eq(paymentStatusTable.operatore, operatore));
    
    const updated = await db.select().from(paymentStatusTable).where(eq(paymentStatusTable.operatore, operatore)).limit(1);
    return {
      operatore: updated[0].operatore,
      paidA: updated[0].paidA,
      paidB: updated[0].paidB,
    };
  }

  async clearPaymentStatus(): Promise<void> {
    await db.delete(paymentStatusTable);
  }
}

export const storage = new DatabaseStorage();
