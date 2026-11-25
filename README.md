# ToneCraft: Multi-Step Message Coach

A two-step Gemini prompt-chaining workspace that diagnoses the emotional subtext of an unfiltered draft and crafts constructive, relationship-aware message rewrites.

Instead of asking a model to rewrite text blindly in a single pass, ToneCraft separates **diagnosis** from **rewriting** into an inspectable sequential pipeline—giving senders visibility into how phrasing, sentence pacing, and trigger words shape how a message lands.

---

## Architecture

```
Unfiltered Draft + Recipient Relationship
        │
        ▼
┌───────────────────────────────────────────┐
│  Step 1 · POST /api/chain/analyze         │
│  Persona: Communication Psychologist      │
│  Output:  Structured JSON Subtext Profile │
│           - detected_tone                 │
│           - aggression_score (1–10)       │
│           - core_goal                     │
│           - trigger_phrases[]             │
└───────────────────────────────────────────┘
        │  (Step 1 JSON passed directly into Step 2)
        ▼
┌───────────────────────────────────────────┐
│  Step 2 · POST /api/chain/rewrite         │
│  Persona: Executive Communication Coach   │
│  Output:  3 Relationship-Tailored Drafts  │
│           - Diplomatic & Warm             │
│           - Firm & Professional           │
│           - Direct & Concise              │
│           + why_it_works rationale        │
└───────────────────────────────────────────┘
```

### Resilience & Model Failover

- **Server-side Gemini proxy (`server.ts`)**: Keeps `GEMINI_API_KEY` out of client bundles. Uses `gemini-4-hydrogen` with `ThinkingLevel.LOW` and automatically fails over to `gemini-3.1-flash-lite` on `503` / transient unavailability or a 7-second primary timeout.
- **Client retry & diagnostics (`src/App.tsx`, `src/utils/errorLogger.ts`)**: Implements `503` detection with exponential backoff + jitter (up to 3 attempts), 25-second `AbortController` request timeouts, and a collapsible **Connectivity & Error Log** drawer separating environment HMR logs from backend API failures.

---

## Features

- **Subtext Diagnosis Card (`src/components/SubtextDiagnosisCard.tsx`)**
  - **Detected Tone & Aggression Meter**: Color-and-label severity rating (`1–10`) paired with a D3 sparkline (`src/components/AggressionHistoryChart.tsx`) comparing the current score against your local session history.
  - **Flesch-Kincaid Readability (`src/utils/readability.ts`)**: Calculates Grade Level, Reading Ease (`0–100`), average words per sentence, and explains how clipped or dense phrasing contributes to perceived bluntness.
  - **Trigger Phrase Scanner & Clipboard Export**: Highlights flagged trigger words inline inside your original draft and supports one-click copying of the full diagnosis, core goal, or trigger phrases.
- **Three Strategy Rewrites (`src/components/RewriteCards.tsx`)**
  - Generates **Diplomatic & Warm**, **Firm & Professional**, and **Direct & Concise** versions, each accompanied by a psychological rationale (`Why this works`) and one-click copy action.
- **Prompt Chain Inspector (`src/components/PromptChainInspector.tsx`)**
  - Collapsible developer/learning drawer revealing the exact Step 1 JSON payload and the rendered Step 2 prompt sent to Gemini.

---

## Tech Stack

| Layer | Technologies |
| --- | --- |
| Frontend | React 19, TypeScript, Vite 8, Tailwind CSS v4 |
| Motion & Icons | `motion` (`motion/react`), `lucide-react` |
| Data Visualization | D3 (`d3` scaleLinear, line, area, mean) |
| Backend | Express 4, Node.js (`tsx` in dev) |
| AI SDK | `@google/genai` (server-side proxy) |

---

## Getting Started

### Prerequisites

- **Node.js** 20+ (22+ recommended)
- A valid **Google Gemini API key**

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Copy `.env.example` to `.env` and populate your key:

```bash
cp .env.example .env
```

```env
GEMINI_API_KEY="your_gemini_api_key_here"
APP_URL="http://localhost:3000"
```

### 3. Run Locally

```bash
npm run dev
```

Starts the unified Express + Vite server on **`http://localhost:3000`**.

---

## Available Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Starts the Express + Vite development server on port `3000` |
| `npm run lint` | Runs TypeScript type-checking (`tsc --noEmit`) |
| `npm run build` | Builds the production frontend bundle into `dist/` |
| `npm run start` | Runs `server.ts` in production mode |
| `npm run clean` | Removes `dist/` build artifacts |

---

## API Endpoints

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/api/health` | Health check returning `{ "ok": true }` |
| `POST` | `/api/chain/analyze` | Step 1: accepts `{ draft, relationship }` and returns `{ analysis, modelUsed }` |
| `POST` | `/api/chain/rewrite` | Step 2: accepts `{ draft, relationship, analysis }` and returns `{ rewrites, step2Prompt, modelUsed }` |

---

## Project Structure

```
├── index.html                          # HTML shell, fonts, favicon, and OpenGraph metadata
├── metadata.json                       # Application identity and capabilities manifest
├── package.json                        # Scripts and dependencies
├── server.ts                           # Express server, Vite middleware, and Gemini API proxy
├── vite.config.ts                      # Vite build configuration
├── public/
│   └── favicon.svg                     # Brand icon
└── src/
    ├── App.tsx                         # Main workspace and sequential Step 1 → Step 2 orchestrator
    ├── types.ts                        # Shared TypeScript interfaces and relationship presets
    ├── index.css                       # Tailwind v4 setup and font/motion CSS rules
    ├── components/
    │   ├── AggressionHistoryChart.tsx  # D3 sparkline for local score history
    │   ├── ChainProgressBanner.tsx     # Step 1 / Step 2 progress & retry status banner
    │   ├── DraftInputPanel.tsx         # Draft editor, word/length gauge, and relationship selector
    │   ├── ErrorDiagnosticsDrawer.tsx  # Collapsible connectivity & API error inspector
    │   ├── PromptChainInspector.tsx    # Collapsible Step 1 JSON & Step 2 prompt viewer
    │   ├── RewriteCards.tsx            # Three tailored rewrite cards + rationale
    │   └── SubtextDiagnosisCard.tsx    # Tone, score, readability, triggers, and clipboard export
    └── utils/
        ├── errorLogger.ts              # Categorized runtime/API error logger
        └── readability.ts              # Flesch-Kincaid grade level & reading ease calculator
```

---

## License

This project is licensed under the [MIT License](./LICENSE).
