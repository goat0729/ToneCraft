export type ErrorCategory = 'environment_hmr' | 'backend_api';

export type ErrorSource =
  | 'console.error'
  | 'unhandledrejection'
  | 'window.error'
  | 'api_client';

export interface CapturedErrorEntry {
  id: string;
  timestamp: number;
  category: ErrorCategory;
  source: ErrorSource;
  message: string;
  explanation: string;
  endpoint?: string;
}

type ErrorLogListener = (entries: CapturedErrorEntry[]) => void;

const MAX_ENTRIES = 50;
const DEDUPE_WINDOW_MS = 2000;

function formatArg(arg: unknown): string {
  if (arg instanceof Error) {
    return `${arg.name}: ${arg.message}`;
  }
  if (typeof arg === 'string') {
    return arg;
  }
  try {
    return JSON.stringify(arg);
  } catch {
    return String(arg);
  }
}

function isViteWebSocketError(message: string, stack = ''): boolean {
  const combined = `${message}\n${stack}`.toLowerCase();
  return (
    combined.includes('websocket closed without opened') ||
    combined.includes('failed to connect to websocket') ||
    combined.includes('@vite/client') ||
    combined.includes('vite-hmr') ||
    (combined.includes('websocket') && combined.includes('[vite]'))
  );
}

export class ErrorLogger {
  private entries: CapturedErrorEntry[] = [];
  private listeners = new Set<ErrorLogListener>();
  private installed = false;
  private originalConsoleError: ((...args: unknown[]) => void) | null = null;

  private handleUnhandledRejection = (event: PromiseRejectionEvent) => {
    const reason = event.reason;
    const message =
      reason instanceof Error
        ? `${reason.name}: ${reason.message}`
        : formatArg(reason);
    const stack = reason instanceof Error ? reason.stack ?? '' : '';

    if (isViteWebSocketError(message, stack)) {
      this.addEntry({
        category: 'environment_hmr',
        source: 'unhandledrejection',
        message,
        explanation:
          'Local dev environment notice: Vite HMR WebSocket cannot upgrade through the preview proxy. Backend API calls and Gemini requests are unaffected.',
      });
    }
  };

  private handleWindowError = (event: ErrorEvent) => {
    const message = event.message || formatArg(event.error);
    const filename = event.filename || '';
    const stack = event.error instanceof Error ? event.error.stack ?? '' : '';

    if (isViteWebSocketError(message, `${filename}\n${stack}`)) {
      this.addEntry({
        category: 'environment_hmr',
        source: 'window.error',
        message,
        explanation:
          'Local dev environment notice: Vite HMR WebSocket connection failed in the preview browser. App runtime is unaffected.',
      });
    }
  };

  install(): void {
    if (this.installed || typeof window === 'undefined') return;
    this.installed = true;

    this.originalConsoleError = console.error.bind(console);
    console.error = (...args: unknown[]) => {
      try {
        const joined = args.map(formatArg).join(' ');
        if (isViteWebSocketError(joined)) {
          this.addEntry({
            category: 'environment_hmr',
            source: 'console.error',
            message: joined,
            explanation:
              'Local dev environment notice: Vite HMR WebSocket closed in the preview proxy. Does not indicate backend unavailability.',
          });
        }
      } catch {
        // Never disrupt console.error execution
      }
      this.originalConsoleError?.(...args);
    };

    window.addEventListener('unhandledrejection', this.handleUnhandledRejection);
    window.addEventListener('error', this.handleWindowError);
  }

  uninstall(): void {
    if (!this.installed || typeof window === 'undefined') return;
    if (this.originalConsoleError) {
      console.error = this.originalConsoleError;
      this.originalConsoleError = null;
    }
    window.removeEventListener('unhandledrejection', this.handleUnhandledRejection);
    window.removeEventListener('error', this.handleWindowError);
    this.installed = false;
  }

  logBackendError(message: string, endpoint?: string): void {
    this.addEntry({
      category: 'backend_api',
      source: 'api_client',
      message,
      endpoint,
      explanation:
        'Backend service or Gemini API unavailability (e.g., 503 high demand, timeout, or unreachable server).',
    });
  }

  private addEntry(
    entry: Omit<CapturedErrorEntry, 'id' | 'timestamp'>
  ): void {
    const now = Date.now();
    const normalized = entry.message.trim().toLowerCase();

    const recentDuplicate = this.entries.find(
      (existing) =>
        existing.category === entry.category &&
        now - existing.timestamp < DEDUPE_WINDOW_MS &&
        (existing.message.trim().toLowerCase() === normalized ||
          (entry.category === 'environment_hmr' &&
            existing.message.toLowerCase().includes('websocket') &&
            normalized.includes('websocket')))
    );

    if (recentDuplicate) {
      return;
    }

    const nextEntry: CapturedErrorEntry = {
      ...entry,
      id: `${now}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: now,
    };

    this.entries = [nextEntry, ...this.entries].slice(0, MAX_ENTRIES);
    this.notify();
  }

  getEntries(): CapturedErrorEntry[] {
    return this.entries;
  }

  clear(): void {
    this.entries = [];
    this.notify();
  }

  subscribe(listener: ErrorLogListener): () => void {
    this.listeners.add(listener);
    listener(this.entries);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener(this.entries);
    }
  }
}

export const errorLogger = new ErrorLogger();
