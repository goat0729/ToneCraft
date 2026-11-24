import { Check, Loader2, Circle } from 'lucide-react';
import type { ChainPhase } from '../types';

interface ChainProgressBannerProps {
  phase: ChainPhase;
  retryNotice?: string | null;
}

export function ChainProgressBanner({ phase, retryNotice }: ChainProgressBannerProps) {
  if (phase === 'idle') return null;

  const step1Done = phase === 'step2' || phase === 'complete';
  const step1Active = phase === 'step1';
  const step2Done = phase === 'complete';
  const step2Active = phase === 'step2';

  return (
    <div
      role="status"
      aria-live="polite"
      className="bg-white border border-slate-200 rounded-xl px-4 py-3 flex flex-col gap-2.5"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className={`w-6 h-6 rounded-md flex items-center justify-center text-xs font-mono shrink-0 ${
              step1Done
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : step1Active
                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                  : 'bg-slate-100 text-slate-500 border border-slate-200'
            }`}
          >
            {step1Done ? (
              <Check className="w-3.5 h-3.5" aria-hidden="true" />
            ) : step1Active ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <Circle className="w-3 h-3" aria-hidden="true" />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-900">
              {step1Active
                ? 'Step 1/2: Analysing emotional subtext...'
                : step1Done
                  ? 'Step 1/2: Subtext diagnosis complete'
                  : 'Step 1/2: Subtext analysis'}
            </p>
            <p className="text-xs text-slate-500">
              Communication psychologist structured JSON extraction
            </p>
          </div>
        </div>

        <div className="hidden sm:block h-px w-8 bg-slate-200 shrink-0" aria-hidden="true" />

        <div className="flex items-center gap-3">
          <div
            className={`w-6 h-6 rounded-md flex items-center justify-center text-xs font-mono shrink-0 ${
              step2Done
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : step2Active
                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                  : 'bg-slate-100 text-slate-400 border border-slate-200'
            }`}
          >
            {step2Done ? (
              <Check className="w-3.5 h-3.5" aria-hidden="true" />
            ) : step2Active ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <span className="tabular-nums">2</span>
            )}
          </div>
          <div className="min-w-0">
            <p
              className={`text-xs font-semibold ${
                step2Active || step2Done ? 'text-slate-900' : 'text-slate-500'
              }`}
            >
              {step2Active
                ? 'Step 2/2: Crafting tailored rewrites...'
                : step2Done
                  ? 'Step 2/2: Three tailored rewrites ready'
                  : 'Step 2/2: Waiting for Step 1 JSON'}
            </p>
            <p className="text-xs text-slate-500">
              Goal-driven rewrites avoiding detected triggers
            </p>
          </div>
        </div>
      </div>

      {retryNotice && (
        <div className="pt-2 border-t border-slate-100 text-xs font-medium text-amber-700 font-mono tabular-nums">
          {retryNotice}
        </div>
      )}
    </div>
  );
}
