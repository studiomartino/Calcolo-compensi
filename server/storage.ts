import { randomUUID } from "crypto";
import { readFileSync, writeFileSync, existsSync } from "fs";
import bcrypt from "bcryptjs";
import type { CompensoRecord, InsertCompensoRecord, ColumnMapping, InsertColumnMapping, Analysis, InsertAnalysis, User, InsertUser, PublicUser, OperatorPaymentStatus } from "@shared/schema";

const DATA_FILE = "./data/storage.json";

interface StorageData {
  records: CompensoRecord[];
  mappings: ColumnMapping[];
  analyses: Analysis[];
  users: User[];
  paymentStatus: OperatorPaymentStatus[];
}

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

  getPaymentStatus(): Promise<OperatorPaymentStatus[]>;
  updatePaymentStatus(operatore: string, field: 'paidA' | 'paidB', value: boolean): Promise<OperatorPaymentStatus>;
  clearPaymentStatus(): Promise<void>;
}

export class MemStorage implements IStorage {
  private records: Map<string, CompensoRecord>;
  private mappings: Map<string, ColumnMapping>;
  private analyses: Map<string, Analysis>;
  private users: Map<string, User>;
  private paymentStatus: Map<string, OperatorPaymentStatus>;

  constructor() {
    this.records = new Map();
    this.mappings = new Map();
    this.analyses = new Map();
    this.users = new Map();
    this.paymentStatus = new Map();
    this.loadFromFile();
    this.ensureAdminUser();
  }

  private async ensureAdminUser(): Promise<void> {
    const adminExists = Array.from(this.users.values()).some(u => u.username === "admin");
    if (!adminExists) {
      const hashedPassword = await bcrypt.hash("CalcoloCompensi2026!!", 10);
      const adminUser: User = {
        id: randomUUID(),
        username: "admin",
        password: hashedPassword,
        role: "admin",
        createdAt: new Date().toISOString(),
      };
      this.users.set(adminUser.id, adminUser);
      this.saveToFile();
      console.log("Admin user created");
    }
  }

  private loadFromFile(): void {
    try {
      if (existsSync(DATA_FILE)) {
        const data = readFileSync(DATA_FILE, "utf-8");
        const parsed: StorageData = JSON.parse(data);
        
        if (parsed.records) {
          parsed.records.forEach(r => this.records.set(r.id, r));
        }
        if (parsed.mappings) {
          parsed.mappings.forEach(m => this.mappings.set(m.id, m));
        }
        if (parsed.analyses) {
          parsed.analyses.forEach(a => this.analyses.set(a.id, a));
        }
        if (parsed.users) {
          parsed.users.forEach(u => this.users.set(u.id, u));
        }
        if (parsed.paymentStatus) {
          parsed.paymentStatus.forEach(p => this.paymentStatus.set(p.operatore, p));
        }
        console.log(`Loaded ${this.records.size} records, ${this.mappings.size} mappings, ${this.analyses.size} analyses, ${this.users.size} users from file`);
      }
    } catch (error) {
      console.error("Error loading data from file:", error);
    }
  }

  private saveToFile(): void {
    try {
      const data: StorageData = {
        records: Array.from(this.records.values()),
        mappings: Array.from(this.mappings.values()),
        analyses: Array.from(this.analyses.values()),
        users: Array.from(this.users.values()),
        paymentStatus: Array.from(this.paymentStatus.values()),
      };
      
      const dir = "./data";
      if (!existsSync(dir)) {
        const { mkdirSync } = require("fs");
        mkdirSync(dir, { recursive: true });
      }
      
      writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), "utf-8");
    } catch (error) {
      console.error("Error saving data to file:", error);
    }
  }

  private checkAnomaly(prezzoAlPaziente: number, compensoOperatore: number): boolean {
    return Math.abs(prezzoAlPaziente - compensoOperatore) < 0.02;
  }

  async getRecords(): Promise<CompensoRecord[]> {
    return Array.from(this.records.values());
  }

  async getRecord(id: string): Promise<CompensoRecord | undefined> {
    return this.records.get(id);
  }

  async createRecord(record: InsertCompensoRecord): Promise<CompensoRecord> {
    const id = randomUUID();
    const hasAnomaly = this.checkAnomaly(record.prezzoAlPaziente, record.compensoOperatore);
    const newRecord: CompensoRecord = { 
      ...record, 
      id,
      hasAnomaly,
      categoriaCompenso: record.categoriaCompenso || "card",
    };
    this.records.set(id, newRecord);
    this.saveToFile();
    return newRecord;
  }

  async createRecords(records: InsertCompensoRecord[]): Promise<CompensoRecord[]> {
    const createdRecords: CompensoRecord[] = [];
    for (const record of records) {
      const id = randomUUID();
      const hasAnomaly = this.checkAnomaly(record.prezzoAlPaziente, record.compensoOperatore);
      const newRecord: CompensoRecord = { 
        ...record, 
        id,
        hasAnomaly,
        categoriaCompenso: record.categoriaCompenso || "card",
      };
      this.records.set(id, newRecord);
      createdRecords.push(newRecord);
    }
    this.saveToFile();
    return createdRecords;
  }

  async updateRecord(id: string, updates: Partial<CompensoRecord>): Promise<CompensoRecord | undefined> {
    const record = this.records.get(id);
    if (!record) return undefined;

    const updatedRecord = { ...record, ...updates };
    
    if ('prezzoAlPaziente' in updates || 'compensoOperatore' in updates) {
      updatedRecord.hasAnomaly = this.checkAnomaly(
        updatedRecord.prezzoAlPaziente,
        updatedRecord.compensoOperatore
      );
    }

    this.records.set(id, updatedRecord);
    this.saveToFile();
    return updatedRecord;
  }

  async updateRecords(ids: string[], updates: Partial<CompensoRecord>): Promise<CompensoRecord[]> {
    const updatedRecords: CompensoRecord[] = [];
    for (const id of ids) {
      const record = this.records.get(id);
      if (record) {
        const updatedRecord = { ...record, ...updates };
        if ('prezzoAlPaziente' in updates || 'compensoOperatore' in updates) {
          updatedRecord.hasAnomaly = this.checkAnomaly(
            updatedRecord.prezzoAlPaziente,
            updatedRecord.compensoOperatore
          );
        }
        this.records.set(id, updatedRecord);
        updatedRecords.push(updatedRecord);
      }
    }
    this.saveToFile();
    return updatedRecords;
  }

  async deleteRecord(id: string): Promise<boolean> {
    const result = this.records.delete(id);
    if (result) this.saveToFile();
    return result;
  }

  async clearRecords(): Promise<void> {
    this.records.clear();
    this.saveToFile();
  }

  async getMappings(): Promise<ColumnMapping[]> {
    return Array.from(this.mappings.values());
  }

  async getMapping(id: string): Promise<ColumnMapping | undefined> {
    return this.mappings.get(id);
  }

  async createMapping(mapping: InsertColumnMapping): Promise<ColumnMapping> {
    const id = randomUUID();
    const newMapping: ColumnMapping = {
      ...mapping,
      id,
      createdAt: new Date().toISOString(),
    };
    this.mappings.set(id, newMapping);
    this.saveToFile();
    return newMapping;
  }

  async deleteMapping(id: string): Promise<boolean> {
    const result = this.mappings.delete(id);
    if (result) this.saveToFile();
    return result;
  }

  async getAnalyses(): Promise<Analysis[]> {
    return Array.from(this.analyses.values()).sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  async getAnalysis(id: string): Promise<Analysis | undefined> {
    return this.analyses.get(id);
  }

  async createAnalysis(analysis: InsertAnalysis): Promise<Analysis> {
    const id = randomUUID();
    const newAnalysis: Analysis = {
      ...analysis,
      id,
      createdAt: new Date().toISOString(),
    };
    this.analyses.set(id, newAnalysis);
    this.saveToFile();
    return newAnalysis;
  }

  async deleteAnalysis(id: string): Promise<boolean> {
    const result = this.analyses.delete(id);
    if (result) this.saveToFile();
    return result;
  }

  async getUsers(): Promise<PublicUser[]> {
    return Array.from(this.users.values()).map(({ password, ...rest }) => rest);
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      u => u.username.toLowerCase() === username.toLowerCase()
    );
  }

  async createUser(user: InsertUser): Promise<PublicUser> {
    const existingUser = await this.getUserByUsername(user.username);
    if (existingUser) {
      throw new Error("Username già esistente");
    }

    const id = randomUUID();
    const hashedPassword = await bcrypt.hash(user.password, 10);
    const newUser: User = {
      id,
      username: user.username,
      password: hashedPassword,
      role: user.role || "user",
      createdAt: new Date().toISOString(),
    };
    this.users.set(id, newUser);
    this.saveToFile();
    
    const { password, ...publicUser } = newUser;
    return publicUser;
  }

  async updateUserPassword(id: string, newPassword: string): Promise<boolean> {
    const user = this.users.get(id);
    if (!user) return false;

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    this.users.set(id, user);
    this.saveToFile();
    return true;
  }

  async deleteUser(id: string): Promise<boolean> {
    const user = this.users.get(id);
    if (!user) return false;
    
    if (user.role === "admin") {
      const adminCount = Array.from(this.users.values()).filter(u => u.role === "admin").length;
      if (adminCount <= 1) {
        throw new Error("Impossibile eliminare l'ultimo amministratore");
      }
    }

    const result = this.users.delete(id);
    if (result) this.saveToFile();
    return result;
  }

  async validateUser(username: string, password: string): Promise<User | null> {
    const user = await this.getUserByUsername(username);
    if (!user) return null;

    const isValid = await bcrypt.compare(password, user.password);
    return isValid ? user : null;
  }

  async getPaymentStatus(): Promise<OperatorPaymentStatus[]> {
    return Array.from(this.paymentStatus.values());
  }

  async updatePaymentStatus(operatore: string, field: 'paidA' | 'paidB', value: boolean): Promise<OperatorPaymentStatus> {
    let status = this.paymentStatus.get(operatore);
    if (!status) {
      status = { operatore, paidA: false, paidB: false };
    }
    status[field] = value;
    this.paymentStatus.set(operatore, status);
    this.saveToFile();
    return status;
  }

  async clearPaymentStatus(): Promise<void> {
    this.paymentStatus.clear();
    this.saveToFile();
  }
}

export const storage = new MemStorage();
