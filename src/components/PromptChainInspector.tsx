import { useState } from 'react';
import { ChevronDown, ChevronUp, Check, Copy, ArrowRight } from 'lucide-react';

interface PromptChainInspectorProps {
  step1RawJson: string | null;
  step2Prompt: {
    model: string;
    systemInstruction: string;
    userPrompt: string;
  } | null;
  isOpen: boolean;
  onToggle: () => void;
}

export function PromptChainInspector({
  step1RawJson,
  step2Prompt,
  isOpen,
  onToggle,
}: PromptChainInspectorProps) {
  const [copiedPane, setCopiedPane] = useState<'json' | 'prompt' | null>(null);

  const hasData = Boolean(step1RawJson || step2Prompt);

  const handleCopy = async (text: string, pane: 'json' | 'prompt') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedPane(pane);
      window.setTimeout(() => {
        setCopiedPane((cur) => (cur === pane ? null : cur));
      }, 2000);
    } catch {
      // Ignore clipboard failures
    }
  };

  const formattedStep2Text = step2Prompt
    ? `MODEL: ${step2Prompt.model}\n\n=== SYSTEM INSTRUCTION ===\n${step2Prompt.systemInstruction}\n\n=== USER PROMPT (Original Draft + Step 1 JSON) ===\n${step2Prompt.userPrompt}`
    : '';

  return (
    <section
      aria-labelledby="prompt-chain-drawer-heading"
      className="bg-white border border-slate-200 rounded-xl overflow-hidden"
    >
      <button
        type="button"
        id="prompt-chain-drawer-heading"
        aria-expanded={isOpen}
        onClick={onToggle}
        className="w-full px-6 py-4 flex items-center justify-between gap-4 text-left hover:bg-slate-50/80 transition-colors cursor-pointer"
      >
        <div className="flex flex-wrap items-baseline gap-2.5">
          <span className="text-sm font-semibold text-slate-900">
            Inspect Prompt Chain (Under the Hood)
          </span>
          <span className="text-xs text-slate-400" aria-hidden="true">
            ·
          </span>
          <span className="text-xs text-slate-500">
            {hasData
              ? 'View Step 1 structured JSON and the exact Step 2 prompt'
              : 'Learning mode: run an analysis to inspect data passing between Gemini calls'}
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
          {/* Chain Data-Flow Architecture Diagram */}
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 pb-4 border-b border-slate-200/80">
            <span className="font-medium text-slate-800">
              1. Draft + Relationship
            </span>
            <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
            <span className="font-mono text-slate-700">
              POST /api/chain/analyze
            </span>
            <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
            <span className="font-medium text-blue-700">
              Step 1 Structured JSON
            </span>
            <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
            <span className="font-mono text-slate-700">
              POST /api/chain/rewrite
            </span>
            <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
            <span className="font-medium text-slate-800">
              3 Goal-Aligned Rewrites
            </span>
          </div>

          {!hasData ? (
            <div className="py-8 text-center text-sm text-slate-500">
              Submit a draft above to inspect the live JSON payload returned by Step 1 and the exact prompt injected into Step 2.
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* Pane 1: Raw JSON from Step 1 */}
              <div className="flex flex-col gap-2 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h3 className="text-xs font-semibold text-slate-900">
                      Step 1 Output — Raw Structured JSON
                    </h3>
                    <p className="text-xs text-slate-500">
                      Returned by the communication psychologist call
                    </p>
                  </div>
                  {step1RawJson && (
                    <button
                      type="button"
                      onClick={() => handleCopy(step1RawJson, 'json')}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-md hover:text-slate-900 transition-colors cursor-pointer shrink-0"
                    >
                      {copiedPane === 'json' ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-600" aria-hidden="true" />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" aria-hidden="true" />
                          <span>Copy JSON</span>
                        </>
                      )}
                    </button>
                  )}
                </div>

                <pre className="p-4 bg-slate-900 text-slate-100 rounded-lg text-xs font-mono leading-relaxed overflow-x-auto max-h-[360px] overflow-y-auto">
                  {step1RawJson ?? 'Waiting for Step 1 JSON...'}
                </pre>
              </div>

              {/* Pane 2: Exact Prompt Sent to Step 2 */}
              <div className="flex flex-col gap-2 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h3 className="text-xs font-semibold text-slate-900">
                      Step 2 Input — Exact Prompt Sent to Gemini
                    </h3>
                    <p className="text-xs text-slate-500">
                      Combines original draft + Step 1 JSON constraints
                    </p>
                  </div>
                  {step2Prompt && (
                    <button
                      type="button"
                      onClick={() => handleCopy(formattedStep2Text, 'prompt')}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-md hover:text-slate-900 transition-colors cursor-pointer shrink-0"
                    >
                      {copiedPane === 'prompt' ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-600" aria-hidden="true" />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" aria-hidden="true" />
                          <span>Copy Prompt</span>
                        </>
                      )}
                    </button>
                  )}
                </div>

                <pre className="p-4 bg-slate-900 text-slate-100 rounded-lg text-xs font-mono leading-relaxed overflow-x-auto whitespace-pre-wrap max-h-[360px] overflow-y-auto">
                  {step2Prompt
                    ? formattedStep2Text
                    : 'Waiting for Step 2 prompt generation...'}
                </pre>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
