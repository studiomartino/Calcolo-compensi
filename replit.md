# Gestione Compensi - Calcolo e Report Collaboratori

## Overview

Applicazione web fullstack per la gestione e il calcolo dei compensi dei collaboratori. Permette l'importazione di dati da file CSV/Excel, la mappatura delle colonne, la gestione di record con categorie (carta/contanti), il rilevamento di anomalie e la generazione di report dettagliati per operatore.

## Funzionalità Principali

- **Importazione File**: Supporto per CSV ed Excel (.xlsx, .xls) con drag-and-drop
- **Mappatura Colonne**: Interfaccia visuale per associare le colonne del file ai campi dell'applicazione
- **Periodo di Riferimento**: Ogni importazione richiede un range di date che identifica l'analisi
- **Archiviazione Automatica**: Le analisi precedenti vengono archiviate automaticamente ad ogni nuova importazione
- **Categorie Compenso**: Due categorie esclusive per ogni record:
  - 💳 Carta (default per nuove importazioni)
  - 💵 Contanti
- **Modifica Categorie**: Toggle singolo o selezione multipla con azioni bulk
- **Rilevamento Anomalie**: Evidenziazione automatica quando compenso operatore = prezzo paziente
- **Dashboard Operatori**: Report con compensi arrotondati alla decina, statistiche carta/contanti
- **Archivio Analisi**: Storico delle analisi precedenti con dettagli espandibili
- **Esportazione Excel**: Export completo con report e dettaglio prestazioni

## Architettura

### Frontend (client/)
- React con TypeScript
- TanStack Query per state management
- Shadcn/UI per componenti
- Tailwind CSS per styling
- PapaParse per parsing CSV
- SheetJS (xlsx) per Excel

### Backend (server/)
- Express.js
- In-memory storage (MemStorage)
- API REST per CRUD operazioni

### Shared (shared/)
- Schema Zod per validazione
- Tipi TypeScript condivisi

## Struttura File Principali

```
client/src/
├── components/
│   ├── file-upload.tsx        # Upload file CSV/Excel
│   ├── column-mapper.tsx      # Mappatura colonne + date range
│   ├── data-table.tsx         # Tabella dati con toggle categoria
│   ├── operator-dashboard.tsx # Dashboard e report carta/contanti
│   ├── analysis-archive.tsx   # Archivio analisi storiche
│   ├── theme-provider.tsx     # Provider tema dark/light
│   └── theme-toggle.tsx       # Toggle tema
├── pages/
│   └── home.tsx               # Pagina principale
└── App.tsx                    # Root component

server/
├── routes.ts                  # API endpoints
└── storage.ts                 # In-memory storage

shared/
└── schema.ts                  # Tipi e validazione
```

## API Endpoints

- `GET /api/records` - Lista tutti i record
- `POST /api/records/import` - Importa nuovi record (archivia automaticamente i precedenti)
- `PATCH /api/records/:id` - Aggiorna un record
- `PATCH /api/records/bulk/update` - Aggiorna più record contemporaneamente
- `GET /api/mappings` - Lista mappature salvate
- `POST /api/mappings` - Salva una mappatura
- `DELETE /api/mappings/:id` - Elimina una mappatura
- `GET /api/analyses` - Lista analisi archiviate
- `GET /api/analyses/:id` - Dettaglio singola analisi
- `DELETE /api/analyses/:id` - Elimina un'analisi

## Campi Dati

| Campo | Descrizione |
|-------|-------------|
| categoriaCompenso | "card" (💳) o "cash" (💵) - categoria esclusiva |
| operatore | Nome del collaboratore |
| paziente | Nome del paziente |
| prestazione | Tipo di servizio erogato |
| elementiDentali | Denti coinvolti nella prestazione |
| prezzoAlPaziente | Importo totale fatturato |
| compensoOperatore | Importo spettante all'operatore |
| hasAnomaly | Flag automatico per anomalie |

## Calcolo Report

Gli importi nei report sono arrotondati alla decina di euro:
- 127€ → 130€
- 123€ → 120€

Anomalia rilevata quando: `|compensoOperatore - prezzoAlPaziente| < 0.02€`

## Running the App

Il workflow "Start application" esegue `npm run dev` che avvia:
- Express server su porta 5000
- Vite dev server per il frontend
