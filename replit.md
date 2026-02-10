# Gestione Compensi - Calcolo e Report Collaboratori

## Overview

Applicazione web fullstack per la gestione e il calcolo dei compensi dei collaboratori. Permette l'importazione di dati da file CSV/Excel, la mappatura delle colonne, la gestione di record con categorie (carta/contanti), il rilevamento di anomalie e la generazione di report dettagliati per operatore.

## Funzionalità Principali

- **Importazione File**: Supporto per CSV ed Excel (.xlsx, .xls) con drag-and-drop
- **Mappatura Colonne**: Interfaccia visuale per associare le colonne del file ai campi dell'applicazione
- **Periodo di Riferimento**: Determinato automaticamente dalle date presenti nei dati importati
- **Archiviazione Manuale**: Le analisi vengono archiviate solo tramite il pulsante dedicato (non automaticamente all'importazione)
- **Categorie Compenso**: Due categorie esclusive per ogni record:
  - Compenso A (icona CreditCard, default per nuove importazioni)
  - Compenso B (icona Banknote)
- **Modifica Categorie**: Toggle singolo o selezione multipla con azioni bulk
- **Navigazione a Tab**: Menu con tre sezioni principali (Importazione, Analisi, Archivio)
- **Rilevamento Anomalie**: Evidenziazione automatica quando compenso operatore = prezzo paziente
- **Dashboard Operatori**: Report con compensi arrotondati alla decina, statistiche Compenso A/B
- **Badge Pagato**: Badge cliccabile in ogni riquadro Compenso A e B per tracciare lo stato di pagamento (verde = pagato, rosso = non pagato)
- **Archivio Analisi**: Storico delle analisi precedenti con dettagli espandibili
- **Esportazione Excel**: Export completo con report e dettaglio prestazioni
- **Rilevamento Duplicati**: Controllo automatico all'importazione con modale di gestione per selezionare quali duplicati importare
- **Sistema Autenticazione**: Login con username/password, sessioni sicure con express-session
- **Gestione Utenti**: Tab amministrazione utenti (solo admin) con CRUD completo
- **Gestione Operatori**: Aggiunta, modifica ed eliminazione operatori dal tab Operatori con persistenza su database

## Sistema Autenticazione

### Credenziali Admin Default
- Username: `admin`
- Password: `CalcoloCompensi2026!!`

### Ruoli Utente
- **admin**: Accesso completo + gestione utenti
- **user**: Accesso alle funzionalità principali (no gestione utenti)

### Sicurezza
- Password hashate con bcrypt (10 rounds)
- Sessioni gestite con express-session
- Tutti gli endpoint dati protetti con middleware `requireAuth`
- Endpoint gestione utenti protetti con middleware `requireAdmin`

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
- PostgreSQL database con Drizzle ORM
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
│   ├── duplicate-modal.tsx    # Modale gestione duplicati importazione
│   ├── users-tab.tsx          # Gestione utenti (solo admin)
│   ├── theme-provider.tsx     # Provider tema dark/light
│   └── theme-toggle.tsx       # Toggle tema
├── pages/
│   ├── home.tsx               # Pagina principale
│   └── login.tsx              # Pagina di login
└── App.tsx                    # Root component con autenticazione

server/
├── routes.ts                  # API endpoints
├── storage.ts                 # Database storage con Drizzle ORM
└── db.ts                      # Connessione PostgreSQL

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
- `POST /api/records/check-duplicates` - Controlla duplicati pre-importazione
- `POST /api/records/archive` - Archivia l'analisi corrente

### Autenticazione (pubblici)
- `POST /api/auth/login` - Login utente
- `POST /api/auth/logout` - Logout utente
- `GET /api/auth/me` - Verifica sessione corrente

### Gestione Operatori
- `GET /api/operators` - Lista tutti gli operatori
- `POST /api/operators` - Crea nuovo operatore
- `PATCH /api/operators/:id` - Aggiorna nome operatore
- `DELETE /api/operators/:id` - Elimina operatore

### Gestione Utenti (solo admin)
- `GET /api/users` - Lista tutti gli utenti
- `POST /api/users` - Crea nuovo utente
- `PATCH /api/users/:id` - Aggiorna utente
- `DELETE /api/users/:id` - Elimina utente

## Campi Dati

| Campo | Descrizione |
|-------|-------------|
| categoriaCompenso | "card" o "cash" - categoria esclusiva (icone CreditCard/Banknote) |
| data | Data della prestazione (usata per determinare il periodo dell'analisi) |
| operatore | Nome del collaboratore |
| paziente | Nome del paziente |
| prestazione | Tipo di servizio erogato |
| elementiDentali | Denti coinvolti nella prestazione |
| prezzoAlPaziente | Importo totale fatturato |
| compensoOperatore | Importo spettante all'operatore |
| hasAnomaly | Flag automatico per anomalie |

## Generazione Nome Analisi

Il nome dell'analisi viene generato automaticamente analizzando le date presenti nei record:
- Un solo mese: "Analisi Giugno 2025"
- Piu mesi dello stesso anno: "Analisi Febbraio, Marzo 2025"
- Mesi di anni diversi: "Analisi Dicembre 2024 - Gennaio 2025"

## Calcolo Report

Gli importi nei report sono arrotondati alla decina di euro:
- 127€ → 130€
- 123€ → 120€

Anomalia rilevata quando: `|compensoOperatore - prezzoAlPaziente| < 0.02€`

## Running the App

Il workflow "Start application" esegue `npm run dev` che avvia:
- Express server su porta 5000
- Vite dev server per il frontend
