import { randomUUID } from "crypto";
import type { CompensoRecord, InsertCompensoRecord, ColumnMapping, InsertColumnMapping, Analysis, InsertAnalysis } from "@shared/schema";

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
}

export class MemStorage implements IStorage {
  private records: Map<string, CompensoRecord>;
  private mappings: Map<string, ColumnMapping>;
  private analyses: Map<string, Analysis>;

  constructor() {
    this.records = new Map();
    this.mappings = new Map();
    this.analyses = new Map();
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
    return newRecord;
  }

  async createRecords(records: InsertCompensoRecord[]): Promise<CompensoRecord[]> {
    const createdRecords: CompensoRecord[] = [];
    for (const record of records) {
      const created = await this.createRecord(record);
      createdRecords.push(created);
    }
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
    return updatedRecord;
  }

  async updateRecords(ids: string[], updates: Partial<CompensoRecord>): Promise<CompensoRecord[]> {
    const updatedRecords: CompensoRecord[] = [];
    for (const id of ids) {
      const updated = await this.updateRecord(id, updates);
      if (updated) {
        updatedRecords.push(updated);
      }
    }
    return updatedRecords;
  }

  async deleteRecord(id: string): Promise<boolean> {
    return this.records.delete(id);
  }

  async clearRecords(): Promise<void> {
    this.records.clear();
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
    return newMapping;
  }

  async deleteMapping(id: string): Promise<boolean> {
    return this.mappings.delete(id);
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
    return newAnalysis;
  }

  async deleteAnalysis(id: string): Promise<boolean> {
    return this.analyses.delete(id);
  }
}

export const storage = new MemStorage();
