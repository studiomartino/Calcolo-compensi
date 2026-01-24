import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { z } from "zod";
import { appFieldNames, type AppFieldName } from "@shared/schema";

const importRecordsSchema = z.object({
  records: z.array(z.record(z.string(), z.string())),
  mappings: z.object({
    operatore: z.string().min(1, "Mappatura 'operatore' richiesta"),
    paziente: z.string().min(1, "Mappatura 'paziente' richiesta"),
    prestazione: z.string().min(1, "Mappatura 'prestazione' richiesta"),
    elementiDentali: z.string().min(1, "Mappatura 'elementiDentali' richiesta"),
    prezzoAlPaziente: z.string().min(1, "Mappatura 'prezzoAlPaziente' richiesta"),
    compensoOperatore: z.string().min(1, "Mappatura 'compensoOperatore' richiesta"),
  }),
});

const updateRecordSchema = z.object({
  categoriaCompenso: z.boolean().optional(),
  operatore: z.string().optional(),
  paziente: z.string().optional(),
  prestazione: z.string().optional(),
  elementiDentali: z.string().optional(),
  prezzoAlPaziente: z.number().optional(),
  compensoOperatore: z.number().optional(),
});

const createMappingSchema = z.object({
  name: z.string().min(1),
  mappings: z.record(z.string(), z.string()),
});

function parseNumber(value: string): number {
  if (!value || value.trim() === "") return 0;
  const cleaned = value.replace(/[€$\s]/g, "").replace(",", ".");
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  app.get("/api/records", async (req, res) => {
    try {
      const records = await storage.getRecords();
      res.json(records);
    } catch (error) {
      res.status(500).json({ error: "Errore nel recupero dei record" });
    }
  });

  app.get("/api/records/:id", async (req, res) => {
    try {
      const record = await storage.getRecord(req.params.id);
      if (!record) {
        return res.status(404).json({ error: "Record non trovato" });
      }
      res.json(record);
    } catch (error) {
      res.status(500).json({ error: "Errore nel recupero del record" });
    }
  });

  app.post("/api/records/import", async (req, res) => {
    try {
      const { records: rawRecords, mappings } = importRecordsSchema.parse(req.body);

      await storage.clearRecords();

      const recordsToCreate = rawRecords.map((rawRecord) => ({
        categoriaCompenso: false,
        operatore: rawRecord[mappings.operatore] || "",
        paziente: rawRecord[mappings.paziente] || "",
        prestazione: rawRecord[mappings.prestazione] || "",
        elementiDentali: rawRecord[mappings.elementiDentali] || "",
        prezzoAlPaziente: parseNumber(rawRecord[mappings.prezzoAlPaziente]),
        compensoOperatore: parseNumber(rawRecord[mappings.compensoOperatore]),
      }));

      const createdRecords = await storage.createRecords(recordsToCreate);
      
      res.status(201).json({ 
        message: "Import completato", 
        count: createdRecords.length,
        records: createdRecords 
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Dati non validi", details: error.errors });
      }
      res.status(500).json({ error: "Errore durante l'importazione" });
    }
  });

  app.patch("/api/records/:id", async (req, res) => {
    try {
      const updates = updateRecordSchema.parse(req.body);
      const record = await storage.updateRecord(req.params.id, updates);
      
      if (!record) {
        return res.status(404).json({ error: "Record non trovato" });
      }
      
      res.json(record);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Dati non validi", details: error.errors });
      }
      res.status(500).json({ error: "Errore nell'aggiornamento del record" });
    }
  });

  app.delete("/api/records/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteRecord(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Record non trovato" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Errore nell'eliminazione del record" });
    }
  });

  app.get("/api/mappings", async (req, res) => {
    try {
      const mappings = await storage.getMappings();
      res.json(mappings);
    } catch (error) {
      res.status(500).json({ error: "Errore nel recupero delle mappature" });
    }
  });

  app.post("/api/mappings", async (req, res) => {
    try {
      const data = createMappingSchema.parse(req.body);
      const mapping = await storage.createMapping(data);
      res.status(201).json(mapping);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Dati non validi", details: error.errors });
      }
      res.status(500).json({ error: "Errore nella creazione della mappatura" });
    }
  });

  app.delete("/api/mappings/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteMapping(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Mappatura non trovata" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Errore nell'eliminazione della mappatura" });
    }
  });

  return httpServer;
}
