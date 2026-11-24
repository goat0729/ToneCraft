import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import type { RewriteOption } from '../types';

interface RewriteCardsProps {
  rewrites: RewriteOption[];
  isLoading: boolean;
}

const STYLE_DESCRIPTORS: Record<string, string> = {
  'Diplomatic & Warm': 'Relationship-preserving & collaborative',
  'Firm & Professional': 'Clear boundaries & poised accountability',
  'Direct & Concise': 'Brief, respectful & action-oriented',
};

export function RewriteCards({ rewrites, isLoading }: RewriteCardsProps) {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const handleCopy = async (text: string, index: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIndex(index);
      window.setTimeout(() => {
        setCopiedIndex((current) => (current === index ? null : current));
      }, 2000);
    } catch {
      // Fallback for restricted clipboard contexts
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopiedIndex(index);
      window.setTimeout(() => {
        setCopiedIndex((current) => (current === index ? null : current));
      }, 2000);
    }
  };

  if (isLoading) {
    return (
      <section aria-label="Loading rewritten messages" className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900">
            Step 2 Output · Tailored Rewrites
          </h3>
          <span className="text-xs text-blue-600 font-medium">
            Step 2/2: Crafting tailored rewrites...
          </span>
        </div>
        {[0, 1, 2].map((skeletonIdx) => (
          <div
            key={skeletonIdx}
            className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col gap-3 animate-pulse"
          >
            <div className="flex items-center justify-between">
              <div className="h-4 w-44 bg-slate-200 rounded" />
              <div className="h-8 w-24 bg-slate-100 rounded-lg" />
            </div>
            <div className="space-y-2 pt-1">
              <div className="h-3.5 w-full bg-slate-100 rounded" />
              <div className="h-3.5 w-11/12 bg-slate-100 rounded" />
              <div className="h-3.5 w-4/5 bg-slate-100 rounded" />
            </div>
            <div className="pt-2 border-t border-slate-100">
              <div className="h-3 w-3/4 bg-slate-100 rounded" />
            </div>
          </div>
        ))}
      </section>
    );
  }

  if (rewrites.length === 0) return null;

  return (
    <section aria-labelledby="rewrites-heading" className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <h3
          id="rewrites-heading"
          className="text-sm font-semibold text-slate-900"
        >
          Step 2 Output · Tailored Rewrites
        </h3>
        <span className="text-xs text-slate-500">
          3 goal-aligned options without flagged triggers
        </span>
      </div>

      {rewrites.map((item, idx) => {
        const isCopied = copiedIndex === idx;
        const descriptor = STYLE_DESCRIPTORS[item.style] ?? 'Tailored response';

        return (
          <article
            key={item.style}
            className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col gap-3.5"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-baseline gap-2">
                <h4 className="text-base font-semibold text-slate-900">
                  {item.style}
                </h4>
                <span className="text-xs text-slate-400" aria-hidden="true">
                  ·
                </span>
                <span className="text-xs text-slate-500">{descriptor}</span>
              </div>

              <button
                type="button"
                onClick={() => handleCopy(item.message, idx)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  isCopied
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                {isCopied ? (
                  <>
                    <Check className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Copy Text</span>
                  </>
                )}
              </button>
            </div>

            <div className="text-[15px] leading-relaxed text-slate-800 whitespace-pre-wrap">
              {item.message}
            </div>

            <div className="pt-3 border-t border-slate-100 flex flex-col gap-1">
              <span className="text-xs font-medium text-slate-500">
                Why this works
              </span>
              <p className="text-xs leading-relaxed text-slate-600">
                {item.why_it_works}
              </p>
            </div>
          </article>
        );
      })}
    </section>
  );
}
