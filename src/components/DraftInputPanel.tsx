import { FileText, Loader2, Eraser, ArrowRight } from 'lucide-react';
import {
  RELATIONSHIP_OPTIONS,
  type ChainPhase,
  type RelationshipType,
} from '../types';

interface DraftInputPanelProps {
  draft: string;
  onDraftChange: (value: string) => void;
  relationship: RelationshipType;
  onRelationshipChange: (value: RelationshipType) => void;
  onLoadSample: () => void;
  onClear: () => void;
  onAnalyze: () => void;
  phase: ChainPhase;
}

export function DraftInputPanel({
  draft,
  onDraftChange,
  relationship,
  onRelationshipChange,
  onLoadSample,
  onClear,
  onAnalyze,
  phase,
}: DraftInputPanelProps) {
  const isRunning = phase === 'step1' || phase === 'step2';
  const trimmedLength = draft.trim().length;
  const wordCount = draft.trim() ? draft.trim().split(/\s+/).length : 0;

  const buttonLabel =
    phase === 'step1'
      ? 'Step 1/2: Analysing emotional subtext...'
      : phase === 'step2'
        ? 'Step 2/2: Crafting tailored rewrites...'
        : 'Analyse & Rewrite';

  return (
    <section
      aria-labelledby="draft-input-heading"
      className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col gap-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2
            id="draft-input-heading"
            className="text-base font-semibold text-slate-900 tracking-tight"
          >
            Draft Message
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Paste your raw, unfiltered message to begin the two-step chain.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {draft.length > 0 && (
            <button
              type="button"
              onClick={onClear}
              disabled={isRunning}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:text-slate-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Eraser className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Clear</span>
            </button>
          )}
          <button
            type="button"
            onClick={onLoadSample}
            disabled={isRunning}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 border border-slate-200/80 rounded-lg hover:bg-slate-200/70 hover:text-slate-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap shrink-0 cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Load Sample Draft</span>
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="relationship-select"
          className="text-xs font-medium text-slate-700"
        >
          Recipient Relationship
        </label>
        <select
          id="relationship-select"
          value={relationship}
          onChange={(e) => onRelationshipChange(e.target.value as RelationshipType)}
          disabled={isRunning}
          className="w-full h-10 px-3 text-sm text-slate-900 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-colors disabled:bg-slate-50 disabled:text-slate-500 cursor-pointer"
        >
          {RELATIONSHIP_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5 flex-1">
        <label
          htmlFor="draft-textarea"
          className="text-xs font-medium text-slate-700"
        >
          Unfiltered Draft
        </label>

        <div className="flex flex-col bg-slate-50/50 border border-slate-200 rounded-lg overflow-hidden focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-600/20 focus-within:border-blue-600 transition-colors">
          <textarea
            id="draft-textarea"
            aria-describedby="draft-length-indicator"
            value={draft}
            onChange={(e) => onDraftChange(e.target.value)}
            disabled={isRunning}
            rows={12}
            placeholder="Write or paste your frustrated email, Slack reply, or text message here..."
            className="w-full min-h-[248px] p-4 text-[15px] leading-relaxed text-slate-900 placeholder:text-slate-400 bg-transparent border-0 resize-y focus:outline-none disabled:opacity-70"
          />

          <div
            id="draft-length-indicator"
            aria-live="polite"
            className="px-4 py-2 border-t border-slate-200/80 bg-slate-50/80 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600"
          >
            <span className="font-medium">
              {wordCount === 0
                ? 'Ready for draft'
                : wordCount < 45
                  ? 'Brief note'
                  : wordCount <= 200
                    ? 'Standard email length'
                    : 'Long-form email'}
            </span>
            <span className="font-mono tabular-nums text-slate-700">
              {wordCount} {wordCount === 1 ? 'word' : 'words'} · {draft.length}{' '}
              {draft.length === 1 ? 'char' : 'chars'}
            </span>
          </div>
        </div>
      </div>

      <div className="pt-1 flex flex-col gap-2">
        <button
          type="button"
          onClick={onAnalyze}
          disabled={isRunning || trimmedLength === 0}
          className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 active:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 transition-colors disabled:bg-slate-200 disabled:text-slate-500 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap"
        >
          {isRunning ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin shrink-0" aria-hidden="true" />
              <span className="truncate">{buttonLabel}</span>
            </>
          ) : (
            <>
              <span>{buttonLabel}</span>
              <ArrowRight className="w-4 h-4 shrink-0" aria-hidden="true" />
            </>
          )}
        </button>
      </div>
    </section>
  );
}
