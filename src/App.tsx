import { useState } from 'react';
import { AlertCircle, ArrowDown } from 'lucide-react';
import { DraftInputPanel } from './components/DraftInputPanel';
import { ChainProgressBanner } from './components/ChainProgressBanner';
import { SubtextDiagnosisCard } from './components/SubtextDiagnosisCard';
import { RewriteCards } from './components/RewriteCards';
import { PromptChainInspector } from './components/PromptChainInspector';
import { ErrorDiagnosticsDrawer } from './components/ErrorDiagnosticsDrawer';
import { errorLogger } from './utils/errorLogger';
import type {
  AnalysisHistoryEntry,
  ChainPhase,
  RelationshipType,
  RewriteOption,
  Step1ApiResponse,
  Step2ApiResponse,
  SubtextAnalysis,
} from './types';

const HISTORY_STORAGE_KEY = 'tonecraft_analysis_history_v1';

function loadStoredHistory(): AnalysisHistoryEntry[] {
  try {
    const raw = window.localStorage.getItem(HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as AnalysisHistoryEntry[]) : [];
  } catch {
    return [];
  }
}

function saveStoredHistory(entries: AnalysisHistoryEntry[]): void {
  try {
    window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Ignore storage quota / privacy mode errors
  }
}

class RetryableApiError extends Error {
  statusCode?: number;

  constructor(message: string, statusCode?: number) {
    super(message);
    this.name = 'RetryableApiError';
    this.statusCode = statusCode;
  }
}

function isServiceUnavailableError(status: number, text: string): boolean {
  const lower = text.toLowerCase();
  return (
    status === 503 ||
    lower.includes('503') ||
    lower.includes('service unavailable') ||
    lower.includes('high demand') ||
    lower.includes('"status":"unavailable"')
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function parseSingleResponse<T>(res: Response, fallbackError: string): Promise<T> {
  const rawText = await res.text();
  const contentType = res.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    let parsed: (T & { error?: string }) | null = null;
    try {
      parsed = JSON.parse(rawText) as T & { error?: string };
    } catch {
      throw new RetryableApiError(
        'Received an incomplete JSON response from the server.'
      );
    }

    if (!res.ok) {
      const serverMessage = parsed?.error || fallbackError;
      if (isServiceUnavailableError(res.status, serverMessage)) {
        throw new RetryableApiError(serverMessage, 503);
      }
      if (res.status === 502 || res.status === 504 || res.status === 429) {
        throw new RetryableApiError(serverMessage, res.status);
      }
      throw new Error(serverMessage);
    }

    return parsed;
  }

  // Handle non-JSON responses (e.g., HTML proxy/restart/timeout pages starting with <!doctype)
  const trimmed = rawText.trim().toLowerCase();
  if (trimmed.startsWith('<!doctype') || trimmed.startsWith('<html')) {
    const is503Html = isServiceUnavailableError(res.status, rawText);
    throw new RetryableApiError(
      is503Html
        ? '503 Service Unavailable returned while reaching the backend.'
        : 'The backend server is temporarily unavailable or timed out while waiting for Gemini.',
      is503Html ? 503 : res.status
    );
  }

  if (isServiceUnavailableError(res.status, rawText)) {
    throw new RetryableApiError(
      '503 Service Unavailable: The AI service is temporarily experiencing high demand.',
      503
    );
  }

  if (res.status === 502 || res.status === 504 || res.status === 429) {
    throw new RetryableApiError(
      `Temporary service error (HTTP ${res.status}).`,
      res.status
    );
  }

  throw new Error(rawText.trim() || fallbackError);
}

interface ParseApiOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
  timeoutMs?: number;
  onRetry?: (attempt: number, maxAttempts: number, delayMs: number, error: RetryableApiError) => void;
}

async function parseApiResponse<T>(
  requestFn: (signal: AbortSignal) => Promise<Response>,
  fallbackError: string,
  options: ParseApiOptions = {}
): Promise<T> {
  const { maxAttempts = 3, baseDelayMs = 1000, timeoutMs = 25000, onRetry } = options;

  let lastError: Error = new Error(fallbackError);

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await requestFn(controller.signal);
      return await parseSingleResponse<T>(res, fallbackError);
    } catch (err) {
      let currentError: Error;

      if (err instanceof DOMException && err.name === 'AbortError') {
        currentError = new RetryableApiError(
          'The request timed out while waiting for a response.'
        );
      } else if (err instanceof TypeError) {
        // Fetch throws TypeError on network disconnects / DNS / CORS / offline states
        currentError = new RetryableApiError(
          'Network connection error while reaching the server.'
        );
      } else if (err instanceof Error) {
        currentError = err;
      } else {
        currentError = new Error(fallbackError);
      }

      lastError = currentError;

      if (currentError instanceof RetryableApiError && attempt < maxAttempts) {
        const delayMs = baseDelayMs * Math.pow(2, attempt - 1) + Math.floor(Math.random() * 250);
        onRetry?.(attempt, maxAttempts, delayMs, currentError);
        await sleep(delayMs);
        continue;
      }

      if (currentError instanceof RetryableApiError && attempt === maxAttempts) {
        if (currentError.statusCode === 503) {
          throw new Error(
            `Service temporarily unavailable (503) after ${maxAttempts} attempts. Please wait a moment and click Retry.`
          );
        }
        throw new Error(
          `${currentError.message} (failed after ${maxAttempts} attempts). Please click Retry.`
        );
      }

      throw currentError;
    } finally {
      window.clearTimeout(timeoutId);
    }
  }

  throw lastError;
}

const SAMPLE_DRAFT = `Subject: Q4 Launch Assets — Seriously?

Mark,

This is the third time I've had to follow up on the client deck numbers and honestly I'm tired of chasing you down for basic updates. Every time we miss a handoff like this, I'm the one left scrambling to explain the delay to leadership while you go completely radio silent.

If you actually cared about hitting Friday's deadline, you would have flagged the missing data two days ago instead of dumping this on me at the last minute. Just send me whatever you have by 2 PM today—no more excuses.`;

export default function App() {
  const [draft, setDraft] = useState('');
  const [relationship, setRelationship] = useState<RelationshipType>('Coworker');
  const [phase, setPhase] = useState<ChainPhase>('idle');
  const [retryNotice, setRetryNotice] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [analyzedDraft, setAnalyzedDraft] = useState('');
  const [analysis, setAnalysis] = useState<SubtextAnalysis | null>(null);
  const [rewrites, setRewrites] = useState<RewriteOption[]>([]);

  // Real historical aggression score log persisted in localStorage
  const [scoreHistory, setScoreHistory] = useState<AnalysisHistoryEntry[]>(() =>
    loadStoredHistory()
  );
  const [previousHistorySnapshot, setPreviousHistorySnapshot] = useState<
    AnalysisHistoryEntry[]
  >([]);

  // Learning Mode drawer state
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [step1RawJson, setStep1RawJson] = useState<string | null>(null);
  const [step2Prompt, setStep2Prompt] = useState<Step2ApiResponse['exactPromptSent'] | null>(null);

  const handleLoadSample = () => {
    setDraft(SAMPLE_DRAFT);
    setRelationship('Coworker');
    setErrorMessage(null);
  };

  const handleClear = () => {
    setDraft('');
    setPhase('idle');
    setRetryNotice(null);
    setErrorMessage(null);
    setAnalysis(null);
    setRewrites([]);
    setStep1RawJson(null);
    setStep2Prompt(null);
    setAnalyzedDraft('');
  };

  const handleAnalyzeAndRewrite = async () => {
    const trimmed = draft.trim();
    if (!trimmed) return;

    setErrorMessage(null);
    setRetryNotice(null);
    setAnalysis(null);
    setRewrites([]);
    setStep1RawJson(null);
    setStep2Prompt(null);
    setAnalyzedDraft(trimmed);

    const retryOptions: ParseApiOptions = {
      maxAttempts: 3,
      baseDelayMs: 1000,
      timeoutMs: 25000,
      onRetry: (attempt, maxAttempts, delayMs, err) => {
        const prefix =
          err.statusCode === 503
            ? '503 Service Unavailable'
            : 'Temporary connection issue';
        setRetryNotice(
          `${prefix} — retrying in ${(delayMs / 1000).toFixed(1)}s (attempt ${attempt + 1} of ${maxAttempts})...`
        );
      },
    };

    // Step 1/2: Hidden Analysis Call
    setPhase('step1');
    let step1Data: Step1ApiResponse;

    try {
      step1Data = await parseApiResponse<Step1ApiResponse>(
        (signal) =>
          fetch('/api/chain/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal,
            body: JSON.stringify({
              draft: trimmed,
              relationship,
            }),
          }),
        'Step 1 analysis failed.',
        retryOptions
      );
      setRetryNotice(null);
      setAnalysis(step1Data.analysis);
      setStep1RawJson(step1Data.rawJsonOutput);

      // Snapshot previous inputs before appending this completed run
      setPreviousHistorySnapshot(scoreHistory);
      const nextEntry: AnalysisHistoryEntry = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        timestamp: Date.now(),
        relationship,
        detected_tone: step1Data.analysis.detected_tone,
        aggression_score: step1Data.analysis.aggression_score,
      };
      const updatedHistory = [...scoreHistory, nextEntry].slice(-50);
      setScoreHistory(updatedHistory);
      saveStoredHistory(updatedHistory);
    } catch (err) {
      setRetryNotice(null);
      const msg =
        err instanceof Error ? err.message : 'Step 1 failed while analysing emotional subtext.';
      errorLogger.logBackendError(msg, '/api/chain/analyze');
      setPhase('error');
      setErrorMessage(msg);
      return;
    }

    // Step 2/2: Tailored Generation Call using original draft + Step 1 JSON
    setPhase('step2');

    try {
      const step2Data = await parseApiResponse<Step2ApiResponse>(
        (signal) =>
          fetch('/api/chain/rewrite', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal,
            body: JSON.stringify({
              draft: trimmed,
              relationship,
              analysis: step1Data.analysis,
            }),
          }),
        'Step 2 rewrite generation failed.',
        retryOptions
      );
      setRetryNotice(null);
      setRewrites(step2Data.rewrites);
      setStep2Prompt(step2Data.exactPromptSent);
      setPhase('complete');
    } catch (err) {
      setRetryNotice(null);
      const msg =
        err instanceof Error ? err.message : 'Step 2 failed while crafting tailored rewrites.';
      errorLogger.logBackendError(msg, '/api/chain/rewrite');
      setPhase('error');
      setErrorMessage(msg);
    }
  };

  const handleClearHistory = () => {
    setScoreHistory([]);
    setPreviousHistorySnapshot([]);
    saveStoredHistory([]);
  };

  const handleOpenInspector = () => {
    setInspectorOpen(true);
    const el = document.getElementById('prompt-chain-drawer');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F6F7F9] text-slate-900">
      {/* Top Navigation Bar (3-zone contract) */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-[1320px] mx-auto px-6 h-16 flex items-center justify-between gap-8">
          <a
            href="#top"
            className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
          >
            ToneCraft
          </a>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
            <a
              href="#workspace"
              className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
            >
              Workspace
            </a>
            <button
              type="button"
              onClick={handleOpenInspector}
              className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Prompt Chain
            </button>
          </nav>

          <div className="flex items-center shrink-0">
            <button
              type="button"
              onClick={handleLoadSample}
              disabled={phase === 'step1' || phase === 'step2'}
              className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200/80 hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 disabled:opacity-50 cursor-pointer"
            >
              Load Sample Draft
            </button>
          </div>
        </div>
      </header>

      {/* Main Workspace */}
      <main id="workspace" className="flex-1 max-w-[1320px] w-full mx-auto px-6 py-8 flex flex-col gap-8">
        {/* Focused Workspace Title */}
        <div className="flex flex-col gap-1.5 max-w-2xl">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 text-balance">
            Multi-Step Message Coach
          </h1>
          <p className="text-sm sm:text-[15px] text-slate-600 leading-relaxed">
            Turn heated or unclear drafts into constructive messages through a transparent two-step Gemini prompt chain: emotional subtext diagnosis first, tailored rewrites second.
          </p>
        </div>

        {/* Two-Column Split Workspace */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Input Section */}
          <div className="lg:col-span-5 lg:sticky lg:top-6">
            <DraftInputPanel
              draft={draft}
              onDraftChange={setDraft}
              relationship={relationship}
              onRelationshipChange={setRelationship}
              onLoadSample={handleLoadSample}
              onClear={handleClear}
              onAnalyze={handleAnalyzeAndRewrite}
              phase={phase}
            />
          </div>

          {/* Right Column: Output Section */}
          <div className="lg:col-span-7 flex flex-col gap-5">
            <ChainProgressBanner phase={phase} retryNotice={retryNotice} />

            {errorMessage && (
              <div
                role="alert"
                className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-start gap-3 text-rose-900"
              >
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" aria-hidden="true" />
                <div className="flex-1 text-sm">
                  <p className="font-semibold">Prompt Chain Error</p>
                  <p className="text-rose-800 mt-0.5">{errorMessage}</p>
                </div>
                <button
                  type="button"
                  onClick={handleAnalyzeAndRewrite}
                  className="px-3 py-1.5 text-xs font-medium text-rose-900 bg-white border border-rose-200 rounded-lg hover:bg-rose-100/60 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Retry
                </button>
              </div>
            )}

            {/* Empty State */}
            {phase === 'idle' && !analysis && !errorMessage && (
              <div className="bg-white border border-slate-200 rounded-xl p-8 flex flex-col gap-6">
                <div>
                  <h2 className="text-base font-semibold text-slate-900">
                    How the Two-Step Prompt Chain Works
                  </h2>
                  <p className="text-sm text-slate-600 mt-1 leading-relaxed">
                    Instead of asking Gemini to diagnose and rewrite in a single prompt, ToneCraft separates reasoning into two sequential API calls for higher precision and clarity.
                  </p>
                </div>

                <div className="flex flex-col gap-4 pt-2 border-t border-slate-100">
                  <div className="flex items-start gap-3.5">
                    <span className="w-6 h-6 rounded-md bg-slate-100 border border-slate-200 text-xs font-mono font-semibold text-slate-700 flex items-center justify-center shrink-0 mt-0.5">
                      01
                    </span>
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900">
                        Step 1 — Hidden Subtext Analysis
                      </h3>
                      <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                        Gemini acts as a communication psychologist and returns a strict JSON schema with detected tone, aggression score (1–10), your core constructive goal, and exact trigger phrases.
                      </p>
                    </div>
                  </div>

                  <div className="pl-3">
                    <ArrowDown className="w-3.5 h-3.5 text-slate-300" aria-hidden="true" />
                  </div>

                  <div className="flex items-start gap-3.5">
                    <span className="w-6 h-6 rounded-md bg-slate-100 border border-slate-200 text-xs font-mono font-semibold text-slate-700 flex items-center justify-center shrink-0 mt-0.5">
                      02
                    </span>
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900">
                        Step 2 — Tailored Rewrite Generation
                      </h3>
                      <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                        Your original draft and the Step 1 JSON diagnosis are passed into a second Gemini call to produce Diplomatic &amp; Warm, Firm &amp; Professional, and Direct &amp; Concise options.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleLoadSample}
                    className="inline-flex items-center px-4 py-2 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200/80 rounded-lg hover:bg-blue-100/70 transition-colors cursor-pointer"
                  >
                    Load Sample Frustrated Email
                  </button>
                </div>
              </div>
            )}

            {/* Step 1 Loading Skeleton */}
            {phase === 'step1' && (
              <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col gap-4 animate-pulse">
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <div className="space-y-2">
                    <div className="h-3 w-36 bg-slate-100 rounded" />
                    <div className="h-5 w-48 bg-slate-200 rounded" />
                  </div>
                  <div className="h-7 w-32 bg-slate-100 rounded-md" />
                </div>
                <div className="h-2 w-full bg-slate-100 rounded" />
                <div className="h-14 w-full bg-slate-100 rounded-lg" />
                <div className="flex gap-2">
                  <div className="h-6 w-28 bg-slate-100 rounded-md" />
                  <div className="h-6 w-36 bg-slate-100 rounded-md" />
                  <div className="h-6 w-24 bg-slate-100 rounded-md" />
                </div>
              </div>
            )}

            {/* Step 1 Diagnosis Card (shown immediately after Step 1 completes) */}
            {analysis && (
              <SubtextDiagnosisCard
                analysis={analysis}
                originalDraft={analyzedDraft}
                previousHistory={previousHistorySnapshot}
                onClearHistory={handleClearHistory}
              />
            )}

            {/* Step 2 Rewrites (skeleton during Step 2, populated on complete) */}
            {(phase === 'step2' || rewrites.length > 0) && (
              <RewriteCards
                rewrites={rewrites}
                isLoading={phase === 'step2'}
              />
            )}
          </div>
        </div>

        {/* Learning Mode Toggle: Collapsible Prompt Chain Inspector */}
        <div id="prompt-chain-drawer" className="pt-2 flex flex-col gap-4">
          <PromptChainInspector
            step1RawJson={step1RawJson}
            step2Prompt={step2Prompt}
            isOpen={inspectorOpen}
            onToggle={() => setInspectorOpen((prev) => !prev)}
          />
          <ErrorDiagnosticsDrawer />
        </div>
      </main>
    </div>
  );
}
