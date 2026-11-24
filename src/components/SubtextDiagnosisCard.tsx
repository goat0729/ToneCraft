import { useMemo, useState } from 'react';
import { AlertTriangle, Check, Copy, Eye, EyeOff } from 'lucide-react';
import { AggressionHistoryChart } from './AggressionHistoryChart';
import type { AnalysisHistoryEntry, SubtextAnalysis } from '../types';

interface SubtextDiagnosisCardProps {
  analysis: SubtextAnalysis;
  originalDraft: string;
  previousHistory: AnalysisHistoryEntry[];
  onClearHistory: () => void;
}

function getAggressionSeverity(score: number): {
  label: string;
  barColor: string;
  textColor: string;
} {
  if (score <= 3) {
    return {
      label: 'Low Friction',
      barColor: 'bg-emerald-600',
      textColor: 'text-emerald-700',
    };
  }
  if (score <= 6) {
    return {
      label: 'Moderate Tension',
      barColor: 'bg-amber-500',
      textColor: 'text-amber-700',
    };
  }
  return {
    label: 'High Friction',
    barColor: 'bg-rose-600',
    textColor: 'text-rose-700',
  };
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function SubtextDiagnosisCard({
  analysis,
  originalDraft,
  previousHistory,
  onClearHistory,
}: SubtextDiagnosisCardProps) {
  const [showInlineScan, setShowInlineScan] = useState(false);
  const [copiedTarget, setCopiedTarget] = useState<'all' | 'goal' | 'triggers' | null>(null);
  const severity = getAggressionSeverity(analysis.aggression_score);

  const copyText = async (text: string, target: 'all' | 'goal' | 'triggers') => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
    setCopiedTarget(target);
    window.setTimeout(() => {
      setCopiedTarget((current) => (current === target ? null : current));
    }, 2000);
  };

  const fullAnalysisSummary = useMemo(() => {
    const triggersLine =
      analysis.trigger_phrases.length > 0
        ? analysis.trigger_phrases.map((p) => `"${p}"`).join(', ')
        : 'None flagged';
    return [
      'Emotional Subtext Analysis',
      `Detected Tone: ${analysis.detected_tone}`,
      `Aggression Score: ${analysis.aggression_score}/10 (${severity.label})`,
      `Core Goal: ${analysis.core_goal}`,
      `Trigger Phrases: ${triggersLine}`,
    ].join('\n');
  }, [analysis, severity.label]);

  const highlightedParts = useMemo(() => {
    if (!showInlineScan || !originalDraft || analysis.trigger_phrases.length === 0) {
      return null;
    }

    const validPhrases = analysis.trigger_phrases
      .filter((p) => p.trim().length > 0)
      .sort((a, b) => b.length - a.length);

    if (validPhrases.length === 0) return null;

    const pattern = new RegExp(`(${validPhrases.map(escapeRegExp).join('|')})`, 'gi');
    const parts = originalDraft.split(pattern);

    return parts.map((part, index) => {
      const isTrigger = validPhrases.some(
        (phrase) => phrase.toLowerCase() === part.toLowerCase()
      );
      if (isTrigger) {
        return (
          <mark
            key={index}
            className="bg-rose-100 text-rose-900 px-1 py-0.5 rounded font-medium underline decoration-rose-400 underline-offset-2"
          >
            {part}
          </mark>
        );
      }
      return <span key={index}>{part}</span>;
    });
  }, [showInlineScan, originalDraft, analysis.trigger_phrases]);

  return (
    <section
      aria-labelledby="subtext-diagnosis-heading"
      className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col gap-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <p className="text-xs font-medium text-slate-500 mb-1">
            Step 1 Output · Subtext Diagnosis Card
          </p>
          <h2
            id="subtext-diagnosis-heading"
            className="text-lg font-semibold text-slate-900 tracking-tight"
          >
            Emotional Subtext Analysis
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-col items-start sm:items-end gap-1">
            <span className="text-xs text-slate-500">Detected Tone</span>
            <span className="inline-flex items-center px-2.5 py-1 text-xs font-semibold text-slate-900 bg-slate-100 border border-slate-200 rounded-md">
              {analysis.detected_tone}
            </span>
          </div>

          <button
            type="button"
            onClick={() => copyText(fullAnalysisSummary, 'all')}
            aria-label="Copy full emotional subtext analysis to clipboard"
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              copiedTarget === 'all'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            {copiedTarget === 'all' ? (
              <>
                <Check className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Copy to Clipboard</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Aggression Score Meter */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-slate-700">
            Aggression Score
          </span>
          <div className="flex items-center gap-2 text-xs">
            <span className={`font-semibold ${severity.textColor}`}>
              {severity.label}
            </span>
            <span className="text-slate-300" aria-hidden="true">
              ·
            </span>
            <span className="font-mono font-semibold text-slate-900 tabular-nums">
              {analysis.aggression_score} / 10
            </span>
          </div>
        </div>

        <div
          role="meter"
          aria-label="Aggression Score"
          aria-valuemin={1}
          aria-valuemax={10}
          aria-valuenow={analysis.aggression_score}
          aria-valuetext={`${analysis.aggression_score} out of 10, ${severity.label}`}
          className="grid grid-cols-10 gap-1.5"
        >
          {Array.from({ length: 10 }, (_, idx) => {
            const stepValue = idx + 1;
            const isFilled = stepValue <= analysis.aggression_score;
            return (
              <div
                key={stepValue}
                className={`h-2 rounded-sm transition-colors ${
                  isFilled ? severity.barColor : 'bg-slate-100'
                }`}
              />
            );
          })}
        </div>
      </div>

      {/* D3 Historical Aggression Score Comparison */}
      <AggressionHistoryChart
        currentScore={analysis.aggression_score}
        currentTone={analysis.detected_tone}
        previousEntries={previousHistory}
        onClearHistory={onClearHistory}
      />

      {/* Core Goal */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-slate-700">
            Core Goal (Underlying Need)
          </span>
          <button
            type="button"
            onClick={() => copyText(analysis.core_goal, 'goal')}
            aria-label="Copy core goal to clipboard"
            className={`inline-flex items-center gap-1 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              copiedTarget === 'goal'
                ? 'text-emerald-700'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            {copiedTarget === 'goal' ? (
              <>
                <Check className="w-3 h-3" aria-hidden="true" />
                <span>Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3 h-3" aria-hidden="true" />
                <span>Copy Goal</span>
              </>
            )}
          </button>
        </div>
        <p className="text-[15px] leading-relaxed text-slate-900 bg-slate-50 border border-slate-200/80 rounded-lg px-4 py-3">
          {analysis.core_goal}
        </p>
      </div>

      {/* Trigger Phrases */}
      <div className="flex flex-col gap-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-medium text-slate-700">
            Trigger Phrases Flagged ({analysis.trigger_phrases.length})
          </span>
          {analysis.trigger_phrases.length > 0 && (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() =>
                  copyText(
                    analysis.trigger_phrases.map((p) => `"${p}"`).join(', '),
                    'triggers'
                  )
                }
                aria-label="Copy trigger phrases to clipboard"
                className={`inline-flex items-center gap-1 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  copiedTarget === 'triggers'
                    ? 'text-emerald-700'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                {copiedTarget === 'triggers' ? (
                  <>
                    <Check className="w-3 h-3" aria-hidden="true" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" aria-hidden="true" />
                    <span>Copy Triggers</span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => setShowInlineScan((prev) => !prev)}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                {showInlineScan ? (
                  <>
                    <EyeOff className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Hide in draft</span>
                  </>
                ) : (
                  <>
                    <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Highlight in draft</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {analysis.trigger_phrases.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {analysis.trigger_phrases.map((phrase, idx) => (
              <span
                key={`${phrase}-${idx}`}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono text-rose-800 bg-rose-50 border border-rose-200 rounded-md"
              >
                <AlertTriangle className="w-3 h-3 text-rose-600 shrink-0" aria-hidden="true" />
                <span>“{phrase}”</span>
              </span>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-500">
            No harsh or inflammatory trigger phrases were flagged in this draft.
          </p>
        )}

        {showInlineScan && highlightedParts && (
          <div className="mt-1 p-4 bg-slate-50 border border-slate-200 rounded-lg text-sm leading-relaxed text-slate-700 whitespace-pre-wrap">
            {highlightedParts}
          </div>
        )}
      </div>
    </section>
  );
}
