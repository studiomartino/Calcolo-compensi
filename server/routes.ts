import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import session from "express-session";
import { storage } from "./storage";
import { z } from "zod";
import { categoriaCompensoEnum, loginSchema, insertUserSchema, insertOperatorSchema } from "@shared/schema";

declare module "express-session" {
  interface SessionData {
    userId?: string;
    username?: string;
    role?: "admin" | "user";
  }
}

function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Non autenticato" });
  }
  next();
}

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Non autenticato" });
  }
  if (req.session.role !== "admin") {
    return res.status(403).json({ error: "Accesso non autorizzato" });
  }
  next();
}

const importRecordsSchema = z.object({
  records: z.array(z.record(z.string(), z.string())),
  mappings: z.object({
    data: z.string().min(1, "Mappatura 'data' richiesta"),
    operatore: z.string().min(1, "Mappatura 'operatore' richiesta"),
    paziente: z.string().min(1, "Mappatura 'paziente' richiesta"),
    prestazione: z.string().min(1, "Mappatura 'prestazione' richiesta"),
    elementiDentali: z.string().min(1, "Mappatura 'elementiDentali' richiesta"),
    prezzoAlPaziente: z.string().min(1, "Mappatura 'prezzoAlPaziente' richiesta"),
    compensoOperatore: z.string().min(1, "Mappatura 'compensoOperatore' richiesta"),
  }),
});

const updateRecordSchema = z.object({
  categoriaCompenso: categoriaCompensoEnum.optional(),
  operatore: z.string().optional(),
  paziente: z.string().optional(),
  prestazione: z.string().optional(),
  elementiDentali: z.string().optional(),
  prezzoAlPaziente: z.number().optional(),
  compensoOperatore: z.number().optional(),
});

const updateMultipleRecordsSchema = z.object({
  ids: z.array(z.string()),
  updates: updateRecordSchema,
});

const createMappingSchema = z.object({
  name: z.string().min(1),
  mappings: z.record(z.string(), z.string()),
});

const updatePaymentStatusSchema = z.object({
  field: z.enum(['paidA', 'paidB']),
  value: z.boolean(),
});

function parseNumber(value: string): number {
  if (!value || value.trim() === "") return 0;
  const cleaned = value.replace(/[€$\s]/g, "").replace(",", ".");
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

function parseDate(dateStr: string): Date | null {
  if (!dateStr || dateStr.trim() === "") return null;
  
  const formats = [
    /^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/,
    /^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})$/,
    /^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2})$/,
  ];
  
  for (const format of formats) {
    const match = dateStr.trim().match(format);
    if (match) {
      let day: number, month: number, year: number;
      
      if (format === formats[1]) {
        year = parseInt(match[1]);
        month = parseInt(match[2]) - 1;
        day = parseInt(match[3]);
      } else {
        day = parseInt(match[1]);
        month = parseInt(match[2]) - 1;
        year = parseInt(match[3]);
        if (year < 100) {
          year += year < 50 ? 2000 : 1900;
        }
      }
      
      const date = new Date(year, month, day);
      if (!isNaN(date.getTime())) {
        return date;
      }
    }
  }
  
  const parsed = new Date(dateStr);
  return isNaN(parsed.getTime()) ? null : parsed;
}

function generateAnalysisName(dates: (Date | null)[]): { name: string; dateRange: string } {
  const validDates = dates.filter((d): d is Date => d !== null);
  
  if (validDates.length === 0) {
    const now = new Date();
    const monthName = now.toLocaleDateString("it-IT", { month: "long" });
    const capitalizedMonth = monthName.charAt(0).toUpperCase() + monthName.slice(1);
    return {
      name: `Analisi ${capitalizedMonth} ${now.getFullYear()}`,
      dateRange: `${capitalizedMonth} ${now.getFullYear()}`
    };
  }
  
  const monthYearSet = new Map<string, { month: number; year: number }>();
  
  validDates.forEach((date) => {
    const month = date.getMonth();
    const year = date.getFullYear();
    const key = `${year}-${month}`;
    if (!monthYearSet.has(key)) {
      monthYearSet.set(key, { month, year });
    }
  });
  
  const sortedMonths = Array.from(monthYearSet.values()).sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year;
    return a.month - b.month;
  });
  
  const monthNames = [
    "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
    "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"
  ];
  
  if (sortedMonths.length === 1) {
    const { month, year } = sortedMonths[0];
    const monthName = monthNames[month];
    return {
      name: `Analisi ${monthName} ${year}`,
      dateRange: `${monthName} ${year}`
    };
  }
  
  const yearGroups = new Map<number, number[]>();
  sortedMonths.forEach(({ month, year }) => {
    if (!yearGroups.has(year)) {
      yearGroups.set(year, []);
    }
    yearGroups.get(year)!.push(month);
  });
  
  const parts: string[] = [];
  const sortedYears = Array.from(yearGroups.keys()).sort();
  
  sortedYears.forEach((year) => {
    const months = yearGroups.get(year)!.sort((a, b) => a - b);
    const monthNamesForYear = months.map((m) => monthNames[m]);
    parts.push(`${monthNamesForYear.join(", ")} ${year}`);
  });
  
  const dateRange = parts.join(" - ");
  return {
    name: `Analisi ${dateRange}`,
    dateRange
  };
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  app.use(
    session({
      secret: process.env.SESSION_SECRET || "gestione-compensi-secret-key-2026",
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: false,
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000,
      },
    })
  );

  app.get("/api/auth/users-public", async (req, res) => {
    try {
      const users = await storage.getUsers();
      // Restituiamo solo gli username per il menù a tendina (pubblico)
      res.json(users.map(u => ({ id: u.id, username: u.username })));
    } catch (error) {
      res.status(500).json({ error: "Errore nel recupero degli utenti" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const credentials = loginSchema.parse(req.body);
      const user = await storage.validateUser(credentials.username, credentials.password);
      
      if (!user) {
        return res.status(401).json({ error: "Credenziali non valide" });
      }

      req.session.userId = user.id;
      req.session.username = user.username;
      req.session.role = user.role;

      res.json({ 
        id: user.id,
        username: user.username, 
        role: user.role 
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Dati non validi" });
      }
      res.status(500).json({ error: "Errore durante il login" });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ error: "Errore durante il logout" });
      }
      res.json({ message: "Logout effettuato" });
    });
  });

  app.get("/api/auth/me", (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: "Non autenticato" });
    }
    res.json({
      id: req.session.userId,
      username: req.session.username,
      role: req.session.role,
    });
  });

  app.get("/api/users", requireAdmin, async (req, res) => {
    try {
      const users = await storage.getUsers();
      res.json(users);
    } catch (error) {
      res.status(500).json({ error: "Errore nel recupero degli utenti" });
    }
  });

  app.post("/api/users", requireAdmin, async (req, res) => {
    try {
      const userData = insertUserSchema.parse(req.body);
      const user = await storage.createUser(userData);
      res.status(201).json(user);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Dati non validi" });
      }
      if (error instanceof Error && error.message === "Username già esistente") {
        return res.status(409).json({ error: error.message });
      }
      res.status(500).json({ error: "Errore nella creazione dell'utente" });
    }
  });

  app.patch("/api/users/:id/password", requireAdmin, async (req, res) => {
    try {
      const { password } = req.body;
      if (!password || password.length < 6) {
        return res.status(400).json({ error: "Password deve essere almeno 6 caratteri" });
      }
      
      const userId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const updated = await storage.updateUserPassword(userId, password);
      if (!updated) {
        return res.status(404).json({ error: "Utente non trovato" });
      }
      res.json({ message: "Password aggiornata" });
    } catch (error) {
      res.status(500).json({ error: "Errore nell'aggiornamento della password" });
    }
  });

  app.delete("/api/users/:id", requireAdmin, async (req, res) => {
    try {
      const userId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const deleted = await storage.deleteUser(userId);
      if (!deleted) {
        return res.status(404).json({ error: "Utente non trovato" });
      }
      res.status(204).send();
    } catch (error) {
      if (error instanceof Error) {
        return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: "Errore nell'eliminazione dell'utente" });
    }
  });
  
  app.get("/api/records", requireAuth, async (req, res) => {
    try {
      const records = await storage.getRecords();
      res.json(records);
    } catch (error) {
      res.status(500).json({ error: "Errore nel recupero dei record" });
    }
  });

  app.get("/api/records/:id", requireAuth, async (req, res) => {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const record = await storage.getRecord(id);
      if (!record) {
        return res.status(404).json({ error: "Record non trovato" });
      }
      res.json(record);
    } catch (error) {
      res.status(500).json({ error: "Errore nel recupero del record" });
    }
  });

  app.post("/api/records/check-duplicates", requireAuth, async (req, res) => {
    try {
      const { records: rawRecords, mappings } = req.body;
      
      if (!rawRecords || !mappings) {
        return res.status(400).json({ error: "Dati mancanti" });
      }

      const analyses = await storage.getAnalyses();
      const existingRecords = await storage.getRecords();
      
      const allRecords = [...existingRecords];
      analyses.forEach(analysis => {
        allRecords.push(...analysis.records);
      });
      
      const existingKeys = new Set<string>();
      allRecords.forEach(record => {
        const key = `${record.data || ""}|${record.operatore}|${record.paziente}|${record.prestazione}|${record.elementiDentali}`;
        existingKeys.add(key.toLowerCase());
      });
      
      const duplicates: { index: number; data: string; operatore: string; paziente: string; prestazione: string; elementiDentali: string }[] = [];
      
      rawRecords.forEach((rawRecord: Record<string, string>, index: number) => {
        const data = rawRecord[mappings.data] || "";
        const operatore = rawRecord[mappings.operatore] || "";
        const paziente = rawRecord[mappings.paziente] || "";
        const prestazione = rawRecord[mappings.prestazione] || "";
        const elementiDentali = rawRecord[mappings.elementiDentali] || "";
        
        const key = `${data}|${operatore}|${paziente}|${prestazione}|${elementiDentali}`.toLowerCase();
        
        if (existingKeys.has(key)) {
          duplicates.push({ index, data, operatore, paziente, prestazione, elementiDentali });
        }
      });
      
      res.json({ duplicates, hasDuplicates: duplicates.length > 0 });
    } catch (error) {
      res.status(500).json({ error: "Errore nel controllo duplicati" });
    }
  });

  app.post("/api/records/import", requireAuth, async (req, res) => {
    try {
      const validated = importRecordsSchema.parse(req.body);
      const { records: rawRecords, mappings } = validated;
      const preserveCategories = req.body.preserveCategories;

      const dates = rawRecords.map((r) => parseDate(r[mappings.data]));
      const { name: analysisName, dateRange } = generateAnalysisName(dates);

      await storage.clearRecords();

      const recordsToCreate = rawRecords.map((rawRecord) => {
        const categoria = preserveCategories && rawRecord.categoriaCompenso 
          ? (rawRecord.categoriaCompenso as "card" | "cash")
          : "card";
        
        return {
          categoriaCompenso: categoria,
          data: rawRecord[mappings.data] || "",
          operatore: rawRecord[mappings.operatore] || "",
          paziente: rawRecord[mappings.paziente] || "",
          prestazione: rawRecord[mappings.prestazione] || "",
          elementiDentali: rawRecord[mappings.elementiDentali] || "",
          prezzoAlPaziente: parseNumber(rawRecord[mappings.prezzoAlPaziente]),
          compensoOperatore: parseNumber(rawRecord[mappings.compensoOperatore]),
        };
      });

      const createdRecords = await storage.createRecords(recordsToCreate);
      
      res.status(201).json({ 
        message: "Import completato", 
        count: createdRecords.length,
        records: createdRecords,
        analysisName,
        dateRange
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Dati non validi", details: error.errors });
      }
      res.status(500).json({ error: "Errore durante l'importazione" });
    }
  });

  app.patch("/api/records/:id", requireAuth, async (req, res) => {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const updates = updateRecordSchema.parse(req.body);
      const record = await storage.updateRecord(id, updates);
      
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

  app.patch("/api/records/bulk/update", requireAuth, async (req, res) => {
    try {
      const { ids, updates } = updateMultipleRecordsSchema.parse(req.body);
      const updatedRecords = await storage.updateRecords(ids, updates);
      res.json({ updated: updatedRecords.length, records: updatedRecords });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Dati non validi", details: error.errors });
      }
      res.status(500).json({ error: "Errore nell'aggiornamento dei record" });
    }
  });

  app.delete("/api/records/:id", requireAuth, async (req, res) => {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const deleted = await storage.deleteRecord(id);
      if (!deleted) {
        return res.status(404).json({ error: "Record non trovato" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Errore nell'eliminazione del record" });
    }
  });

  app.get("/api/mappings", requireAuth, async (req, res) => {
    try {
      const mappings = await storage.getMappings();
      res.json(mappings);
    } catch (error) {
      res.status(500).json({ error: "Errore nel recupero delle mappature" });
    }
  });

  app.post("/api/mappings", requireAuth, async (req, res) => {
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

  app.delete("/api/mappings/:id", requireAuth, async (req, res) => {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const deleted = await storage.deleteMapping(id);
      if (!deleted) {
        return res.status(404).json({ error: "Mappatura non trovata" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Errore nell'eliminazione della mappatura" });
    }
  });

  app.get("/api/analyses", requireAuth, async (req, res) => {
    try {
      const analyses = await storage.getAnalyses();
      res.json(analyses);
    } catch (error) {
      res.status(500).json({ error: "Errore nel recupero delle analisi" });
    }
  });

  app.get("/api/analyses/:id", requireAuth, async (req, res) => {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const analysis = await storage.getAnalysis(id);
      if (!analysis) {
        return res.status(404).json({ error: "Analisi non trovata" });
      }
      res.json(analysis);
    } catch (error) {
      res.status(500).json({ error: "Errore nel recupero dell'analisi" });
    }
  });

  app.patch("/api/analyses/:id", requireAuth, async (req, res) => {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const { name } = req.body;
      if (!name || typeof name !== "string" || name.trim() === "") {
        return res.status(400).json({ error: "Il nome non può essere vuoto" });
      }
      const updated = await storage.updateAnalysisName(id, name.trim());
      if (!updated) {
        return res.status(404).json({ error: "Analisi non trovata" });
      }
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Errore durante il rinomino dell'analisi" });
    }
  });

  app.delete("/api/analyses/:id", requireAuth, async (req, res) => {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const deleted = await storage.deleteAnalysis(id);
      if (!deleted) {
        return res.status(404).json({ error: "Analisi non trovata" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Errore nell'eliminazione dell'analisi" });
    }
  });

  app.post("/api/analyses/bulk-delete", requireAuth, async (req, res) => {
    try {
      const { ids } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: "IDs non validi" });
      }
      let deletedCount = 0;
      for (const id of ids) {
        const deleted = await storage.deleteAnalysis(id);
        if (deleted) deletedCount++;
      }
      res.json({ deleted: deletedCount });
    } catch (error) {
      res.status(500).json({ error: "Errore nell'eliminazione delle analisi" });
    }
  });

  app.post("/api/records/archive", requireAuth, async (req, res) => {
    try {
      const existingRecords = await storage.getRecords();
      
      if (existingRecords.length === 0) {
        return res.status(400).json({ error: "Nessun record da archiviare" });
      }

      const existingDates = existingRecords
        .map((r) => r.data ? parseDate(r.data) : null);
      const { name: autoName, dateRange } = generateAnalysisName(existingDates);
      
      const customName = req.body?.name?.trim();
      const analysisName = customName || autoName;
      
      const analysis = await storage.createAnalysis({
        name: analysisName,
        dateRange: dateRange,
        records: existingRecords,
      });

      await storage.clearRecords();

      res.status(201).json({ 
        message: "Analisi archiviata con successo",
        analysis
      });
    } catch (error) {
      res.status(500).json({ error: "Errore durante l'archiviazione" });
    }
  });

  app.delete("/api/records/clear", requireAuth, async (req, res) => {
    try {
      await storage.clearRecords();
      res.json({ message: "Record correnti eliminati" });
    } catch (error) {
      res.status(500).json({ error: "Errore nella cancellazione dei record" });
    }
  });

  app.get("/api/operators", requireAuth, async (req, res) => {
    try {
      const operators = await storage.getOperators();
      res.json(operators);
    } catch (error) {
      res.status(500).json({ error: "Errore nel recupero degli operatori" });
    }
  });

  app.post("/api/operators", requireAuth, async (req, res) => {
    try {
      const data = insertOperatorSchema.parse(req.body);
      const operator = await storage.createOperator(data);
      res.status(201).json(operator);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Dati non validi" });
      }
      if (error instanceof Error && error.message.includes("unique")) {
        return res.status(409).json({ error: "Operatore già esistente" });
      }
      res.status(500).json({ error: "Errore nella creazione dell'operatore" });
    }
  });

  app.patch("/api/operators/:id", requireAuth, async (req, res) => {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const updates: Record<string, any> = {};
      if (req.body.name !== undefined) {
        if (typeof req.body.name !== "string" || req.body.name.trim().length === 0) {
          return res.status(400).json({ error: "Nome operatore richiesto" });
        }
        updates.name = req.body.name.trim();
      }
      if (req.body.pagamentoGiornataAttivo !== undefined) updates.pagamentoGiornataAttivo = req.body.pagamentoGiornataAttivo;
      if (req.body.pagamentoGiornataMinimoA !== undefined) updates.pagamentoGiornataMinimoA = req.body.pagamentoGiornataMinimoA;
      if (req.body.pagamentoGiornataMinimoB !== undefined) updates.pagamentoGiornataMinimoB = req.body.pagamentoGiornataMinimoB;
      if (req.body.pagamentoGiornataFissoA !== undefined) updates.pagamentoGiornataFissoA = req.body.pagamentoGiornataFissoA;
      if (req.body.pagamentoGiornataFissoB !== undefined) updates.pagamentoGiornataFissoB = req.body.pagamentoGiornataFissoB;
      
      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ error: "Nessun campo da aggiornare" });
      }
      const operator = await storage.updateOperator(id, updates);
      if (!operator) {
        return res.status(404).json({ error: "Operatore non trovato" });
      }
      res.json(operator);
    } catch (error) {
      if (error instanceof Error && error.message.includes("unique")) {
        return res.status(409).json({ error: "Operatore già esistente con questo nome" });
      }
      res.status(500).json({ error: "Errore nell'aggiornamento dell'operatore" });
    }
  });

  app.delete("/api/operators/:id", requireAuth, async (req, res) => {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const deleted = await storage.deleteOperator(id);
      if (!deleted) {
        return res.status(404).json({ error: "Operatore non trovato" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Errore nell'eliminazione dell'operatore" });
    }
  });

  app.get("/api/payment-status", requireAuth, async (req, res) => {
    try {
      const status = await storage.getPaymentStatus();
      res.json(status);
    } catch (error) {
      res.status(500).json({ error: "Errore nel recupero stato pagamenti" });
    }
  });

  app.patch("/api/payment-status/:operatore", requireAuth, async (req, res) => {
    try {
      const operatore = req.params.operatore as string;
      const parsed = updatePaymentStatusSchema.safeParse(req.body);
      
      if (!parsed.success) {
        return res.status(400).json({ error: "Dati non validi", details: parsed.error.errors });
      }
      
      const { field, value } = parsed.data;
      const status = await storage.updatePaymentStatus(operatore, field, value);
      res.json(status);
    } catch (error) {
      res.status(500).json({ error: "Errore nell'aggiornamento stato pagamento" });
    }
  });

  app.delete("/api/payment-status", requireAuth, async (req, res) => {
    try {
      await storage.clearPaymentStatus();
      res.json({ message: "Stato pagamenti resettato" });
    } catch (error) {
      res.status(500).json({ error: "Errore nel reset stato pagamenti" });
    }
  });

  app.get("/api/pagamento-giornata-modes", requireAuth, async (req, res) => {
    try {
      const analysisId = req.query.analysisId as string;
      const operatorName = req.query.operatorName as string;
      if (!analysisId || !operatorName) {
        return res.status(400).json({ error: "analysisId e operatorName richiesti" });
      }
      const modes = await storage.getGiornataModes(analysisId, operatorName);
      res.json(modes);
    } catch (error) {
      res.status(500).json({ error: "Errore nel recupero delle modalità giornata" });
    }
  });

  app.post("/api/pagamento-giornata-modes", requireAuth, async (req, res) => {
    try {
      const { analysisId, operatorName, workDate, mode } = req.body;
      if (!analysisId || !operatorName || !workDate || !mode) {
        return res.status(400).json({ error: "Tutti i campi sono richiesti" });
      }
      if (!["minimo", "fisso", "none"].includes(mode)) {
        return res.status(400).json({ error: "Mode deve essere 'minimo', 'fisso' o 'none'" });
      }
      const result = await storage.upsertGiornataMode({ analysisId, operatorName, workDate, mode });
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "Errore nel salvataggio della modalità giornata" });
    }
  });

  return httpServer;
}
