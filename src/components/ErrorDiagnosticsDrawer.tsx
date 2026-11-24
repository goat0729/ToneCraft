import { useEffect, useState } from 'react';
import {
  Activity,
  ChevronDown,
  ChevronUp,
  ServerCrash,
  Trash2,
  WifiOff,
} from 'lucide-react';
import { errorLogger, type CapturedErrorEntry } from '../utils/errorLogger';

function formatTimestamp(ts: number): string {
  return new Date(ts).toLocaleTimeString([], {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function ErrorDiagnosticsDrawer() {
  const [isOpen, setIsOpen] = useState(false);
  const [entries, setEntries] = useState<CapturedErrorEntry[]>(() =>
    errorLogger.getEntries()
  );
  const [healthStatus, setHealthStatus] = useState<string | null>(null);
  const [checkingHealth, setCheckingHealth] = useState(false);

  useEffect(() => {
    return errorLogger.subscribe((updated) => {
      setEntries([...updated]);
    });
  }, []);

  const backendCount = entries.filter((e) => e.category === 'backend_api').length;
  const envCount = entries.filter((e) => e.category === 'environment_hmr').length;

  const handleCheckHealth = async () => {
    setCheckingHealth(true);
    setHealthStatus(null);
    const start = performance.now();
    try {
      const res = await fetch('/api/health');
      const elapsed = Math.round(performance.now() - start);
      if (res.ok) {
        setHealthStatus(`Backend reachable (HTTP ${res.status} · ${elapsed}ms)`);
      } else {
        setHealthStatus(`Backend returned HTTP ${res.status}`);
      }
    } catch {
      setHealthStatus('Backend unreachable (network failure)');
    } finally {
      setCheckingHealth(false);
    }
  };

  return (
    <section
      aria-labelledby="diagnostics-drawer-heading"
      className="bg-white border border-slate-200 rounded-xl overflow-hidden"
    >
      <button
        type="button"
        id="diagnostics-drawer-heading"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((prev) => !prev)}
        className="w-full px-6 py-4 flex items-center justify-between gap-4 text-left hover:bg-slate-50/80 transition-colors cursor-pointer"
      >
        <div className="flex flex-wrap items-baseline gap-2.5">
          <span className="text-sm font-semibold text-slate-900">
            Connectivity &amp; Error Log
          </span>
          <span className="text-xs text-slate-400" aria-hidden="true">
            ·
          </span>
          <span className="text-xs text-slate-500 font-mono tabular-nums">
            {entries.length === 0
              ? 'No errors captured'
              : `${backendCount} backend ${backendCount === 1 ? 'error' : 'errors'} · ${envCount} environment ${envCount === 1 ? 'notice' : 'notices'}`}
          </span>
        </div>

        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 shrink-0">
          <span>{isOpen ? 'Hide' : 'Expand'}</span>
          {isOpen ? (
            <ChevronUp className="w-4 h-4" aria-hidden="true" />
          ) : (
            <ChevronDown className="w-4 h-4" aria-hidden="true" />
          )}
        </span>
      </button>

      {isOpen && (
        <div className="border-t border-slate-200 p-6 bg-slate-50/60 flex flex-col gap-5">
          {/* Distinction Guide */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-4 border-b border-slate-200/80">
            <div className="flex items-start gap-3">
              <WifiOff
                className="w-4 h-4 text-amber-600 shrink-0 mt-0.5"
                aria-hidden="true"
              />
              <div>
                <h3 className="text-xs font-semibold text-slate-900">
                  Local Environment / Vite HMR WebSocket
                </h3>
                <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                  Captures browser-side <code className="font-mono">@vite/client</code> WebSocket timeouts (<code className="font-mono">WebSocket closed without opened</code>). Caused by disabled HMR in the preview proxy—non-blocking and safe to ignore.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <ServerCrash
                className="w-4 h-4 text-rose-600 shrink-0 mt-0.5"
                aria-hidden="true"
              />
              <div>
                <h3 className="text-xs font-semibold text-slate-900">
                  Backend Service / Gemini API
                </h3>
                <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                  Captures real <code className="font-mono">/api/chain/*</code> failures such as HTTP 503 demand spikes, request timeouts, or server restarts that prevent prompt chain completion.
                </p>
              </div>
            </div>
          </div>

          {/* Controls Row */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleCheckHealth}
                disabled={checkingHealth}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:text-slate-900 transition-colors disabled:opacity-50 cursor-pointer whitespace-nowrap shrink-0"
              >
                <Activity className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{checkingHealth ? 'Checking...' : 'Check Backend Health'}</span>
              </button>

              {healthStatus && (
                <span className="text-xs font-mono tabular-nums text-slate-700">
                  {healthStatus}
                </span>
              )}
            </div>

            {entries.length > 0 && (
              <button
                type="button"
                onClick={() => errorLogger.clear()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:text-slate-900 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Clear Log</span>
              </button>
            )}
          </div>

          {/* Captured Log Entries */}
          {entries.length === 0 ? (
            <div className="py-6 text-center text-xs text-slate-500">
              No WebSocket or backend API errors have been captured during this session.
            </div>
          ) : (
            <div className="divide-y divide-slate-200 border-t border-slate-200">
              {entries.map((entry) => {
                const isBackend = entry.category === 'backend_api';
                return (
                  <div key={entry.id} className="py-3.5 flex flex-col gap-1.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span
                          className={`px-2 py-0.5 font-medium rounded border ${
                            isBackend
                              ? 'bg-rose-50 text-rose-800 border-rose-200'
                              : 'bg-amber-50 text-amber-800 border-amber-200'
                          }`}
                        >
                          {isBackend
                            ? 'Backend Service · Actionable'
                            : 'Local Environment · Non-blocking'}
                        </span>
                        <span className="text-slate-400" aria-hidden="true">
                          ·
                        </span>
                        <span className="font-mono text-slate-600">
                          {entry.source}
                          {entry.endpoint ? ` (${entry.endpoint})` : ''}
                        </span>
                      </div>

                      <span className="text-xs font-mono tabular-nums text-slate-500">
                        {formatTimestamp(entry.timestamp)}
                      </span>
                    </div>

                    <p className="text-xs font-mono text-slate-900 break-words">
                      {entry.message}
                    </p>
                    <p className="text-xs text-slate-600">{entry.explanation}</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
