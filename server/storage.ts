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
  paymentStatusTable,
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
  type InsertOperator
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
  updateOperator(id: string, name: string): Promise<Operator | undefined>;
  deleteOperator(id: string): Promise<boolean>;

  getPaymentStatus(): Promise<OperatorPaymentStatus[]>;
  updatePaymentStatus(operatore: string, field: 'paidA' | 'paidB', value: boolean): Promise<OperatorPaymentStatus>;
  clearPaymentStatus(): Promise<void>;
  
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

  async getOperators(): Promise<Operator[]> {
    const rows = await db.select().from(operatorsTable).orderBy(operatorsTable.name);
    return rows.map(r => ({
      id: r.id,
      name: r.name,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  async getOperator(id: string): Promise<Operator | undefined> {
    const rows = await db.select().from(operatorsTable).where(eq(operatorsTable.id, id)).limit(1);
    if (rows.length === 0) return undefined;
    const r = rows[0];
    return { id: r.id, name: r.name, createdAt: r.createdAt.toISOString() };
  }

  async createOperator(operator: InsertOperator): Promise<Operator> {
    const id = randomUUID();
    const createdAt = new Date();
    await db.insert(operatorsTable).values({ id, name: operator.name });
    return { id, name: operator.name, createdAt: createdAt.toISOString() };
  }

  async updateOperator(id: string, name: string): Promise<Operator | undefined> {
    const existing = await this.getOperator(id);
    if (!existing) return undefined;
    await db.update(operatorsTable).set({ name }).where(eq(operatorsTable.id, id));
    return { ...existing, name };
  }

  async deleteOperator(id: string): Promise<boolean> {
    const existing = await this.getOperator(id);
    if (!existing) return false;
    await db.delete(operatorsTable).where(eq(operatorsTable.id, id));
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
