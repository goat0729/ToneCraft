import { useId, useMemo, useState } from 'react';
import * as d3 from 'd3';
import type { AnalysisHistoryEntry } from '../types';

interface AggressionHistoryChartProps {
  currentScore: number;
  currentTone: string;
  previousEntries: AnalysisHistoryEntry[];
  onClearHistory: () => void;
}

interface PlotPoint {
  index: number;
  label: string;
  score: number;
  tone: string;
  relationship: string;
  isCurrent: boolean;
}

const CHART_WIDTH = 520;
const CHART_HEIGHT = 112;
const MARGIN = { top: 14, right: 18, bottom: 20, left: 28 };

function getScoreStrokeHex(score: number): string {
  if (score <= 3) return '#059669'; // emerald-600
  if (score <= 6) return '#d97706'; // amber-600
  return '#e11d48'; // rose-600
}

export function AggressionHistoryChart({
  currentScore,
  currentTone,
  previousEntries,
  onClearHistory,
}: AggressionHistoryChartProps) {
  const gradientId = useId();
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // Keep up to the last 11 previous entries + current entry = max 12 points
  const recentPrevious = useMemo(
    () => previousEntries.slice(-11),
    [previousEntries]
  );

  const points: PlotPoint[] = useMemo(() => {
    const prevPoints: PlotPoint[] = recentPrevious.map((entry, idx) => ({
      index: idx,
      label: `#${previousEntries.length - recentPrevious.length + idx + 1}`,
      score: entry.aggression_score,
      tone: entry.detected_tone,
      relationship: entry.relationship,
      isCurrent: false,
    }));

    return [
      ...prevPoints,
      {
        index: prevPoints.length,
        label: 'Current',
        score: currentScore,
        tone: currentTone,
        relationship: 'Active draft',
        isCurrent: true,
      },
    ];
  }, [recentPrevious, previousEntries.length, currentScore, currentTone]);

  const historicalAverage = useMemo(() => {
    if (previousEntries.length === 0) return null;
    const avg = d3.mean(previousEntries, (d) => d.aggression_score);
    return typeof avg === 'number' ? avg : null;
  }, [previousEntries]);

  const delta =
    historicalAverage !== null ? currentScore - historicalAverage : null;

  const { linePath, areaPath, xScale, yScale, avgY } = useMemo(() => {
    const innerWidth = CHART_WIDTH - MARGIN.left - MARGIN.right;
    const innerHeight = CHART_HEIGHT - MARGIN.top - MARGIN.bottom;

    const x = d3
      .scaleLinear()
      .domain([0, Math.max(1, points.length - 1)])
      .range([
        MARGIN.left,
        points.length === 1
          ? MARGIN.left + innerWidth * 0.5
          : MARGIN.left + innerWidth,
      ]);

    const y = d3
      .scaleLinear()
      .domain([1, 10])
      .range([MARGIN.top + innerHeight, MARGIN.top]);

    const lineGenerator = d3
      .line<PlotPoint>()
      .x((d) => x(d.index))
      .y((d) => y(d.score))
      .curve(d3.curveMonotoneX);

    const areaGenerator = d3
      .area<PlotPoint>()
      .x((d) => x(d.index))
      .y0(MARGIN.top + innerHeight)
      .y1((d) => y(d.score))
      .curve(d3.curveMonotoneX);

    return {
      linePath: points.length > 1 ? lineGenerator(points) ?? '' : '',
      areaPath: points.length > 1 ? areaGenerator(points) ?? '' : '',
      xScale: x,
      yScale: y,
      avgY: historicalAverage !== null ? y(historicalAverage) : null,
    };
  }, [points, historicalAverage]);

  const activePoint =
    hoveredIndex !== null ? points[hoveredIndex] ?? null : null;

  const deltaSummary = useMemo(() => {
    if (delta === null || historicalAverage === null) return null;
    const absDelta = Math.abs(delta).toFixed(1);
    if (Math.abs(delta) < 0.05) {
      return {
        text: 'Matches historical average',
        toneClass: 'text-slate-700',
      };
    }
    if (delta > 0) {
      return {
        text: `+${absDelta} above avg`,
        toneClass: 'text-rose-700',
      };
    }
    return {
      text: `-${absDelta} below avg`,
      toneClass: 'text-emerald-700',
    };
  }, [delta, historicalAverage]);

  const currentStroke = getScoreStrokeHex(currentScore);

  return (
    <div className="pt-4 border-t border-slate-100 flex flex-col gap-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="text-xs font-medium text-slate-700">
            Historical Comparison
          </span>
          {historicalAverage !== null && deltaSummary ? (
            <span className="text-xs text-slate-500 font-mono tabular-nums">
              Prev Avg {historicalAverage.toFixed(1)} ({previousEntries.length}{' '}
              {previousEntries.length === 1 ? 'draft' : 'drafts'})
              <span className="mx-1.5 text-slate-300" aria-hidden="true">
                ·
              </span>
              <span className={`font-sans font-semibold ${deltaSummary.toneClass}`}>
                {deltaSummary.text}
              </span>
            </span>
          ) : (
            <span className="text-xs text-slate-500">
              Baseline recorded (1st draft)
            </span>
          )}
        </div>

        {previousEntries.length > 0 && (
          <button
            type="button"
            onClick={onClearHistory}
            className="text-xs text-slate-500 hover:text-slate-800 underline underline-offset-2 transition-colors cursor-pointer whitespace-nowrap"
          >
            Reset history
          </button>
        )}
      </div>

      <div className="w-full">
        <svg
          viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
          className="w-full h-28 overflow-visible"
          role="img"
          aria-label={
            historicalAverage !== null
              ? `Aggression score comparison chart: current draft scored ${currentScore} out of 10 compared to a historical average of ${historicalAverage.toFixed(1)} across ${previousEntries.length} previous drafts.`
              : `Aggression score baseline chart: current draft scored ${currentScore} out of 10.`
          }
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2563eb" stopOpacity="0.16" />
              <stop offset="100%" stopColor="#2563eb" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Y-axis reference ticks (1, 5, 10) */}
          {[1, 5, 10].map((tick) => {
            const yPos = yScale(tick);
            return (
              <g key={tick}>
                <line
                  x1={MARGIN.left}
                  x2={CHART_WIDTH - MARGIN.right}
                  y1={yPos}
                  y2={yPos}
                  stroke="#e2e8f0"
                  strokeWidth={1}
                />
                <text
                  x={MARGIN.left - 8}
                  y={yPos + 3.5}
                  textAnchor="end"
                  className="fill-slate-400 text-[10px] font-mono tabular-nums"
                >
                  {tick}
                </text>
              </g>
            );
          })}

          {/* Historical Average Reference Line */}
          {avgY !== null && historicalAverage !== null && (
            <g>
              <line
                x1={MARGIN.left}
                x2={CHART_WIDTH - MARGIN.right}
                y1={avgY}
                y2={avgY}
                stroke="#475569"
                strokeWidth={1.25}
                strokeDasharray="4 4"
              />
              <text
                x={CHART_WIDTH - MARGIN.right}
                y={Math.max(10, avgY - 5)}
                textAnchor="end"
                className="fill-slate-600 text-[10px] font-mono font-medium tabular-nums"
              >
                Avg {historicalAverage.toFixed(1)}
              </text>
            </g>
          )}

          {/* Area & Trajectory Line */}
          {areaPath && (
            <path d={areaPath} fill={`url(#${gradientId})`} />
          )}
          {linePath && (
            <path
              d={linePath}
              fill="none"
              stroke="#2563eb"
              strokeWidth={2}
              strokeLinecap="round"
            />
          )}

          {/* Data Points */}
          {points.map((pt) => {
            const cx = xScale(pt.index);
            const cy = yScale(pt.score);
            const isHovered = hoveredIndex === pt.index;
            return (
              <g key={`${pt.label}-${pt.index}`}>
                <circle
                  cx={cx}
                  cy={cy}
                  r={pt.isCurrent ? 5.5 : isHovered ? 4.5 : 3.5}
                  fill={pt.isCurrent ? currentStroke : '#ffffff'}
                  stroke={pt.isCurrent ? '#ffffff' : '#2563eb'}
                  strokeWidth={pt.isCurrent ? 2 : 1.75}
                  className="transition-all cursor-pointer"
                  tabIndex={0}
                  aria-label={`${pt.label}: ${pt.score} out of 10 (${pt.tone})`}
                  onMouseEnter={() => setHoveredIndex(pt.index)}
                  onMouseLeave={() => setHoveredIndex(null)}
                  onFocus={() => setHoveredIndex(pt.index)}
                  onBlur={() => setHoveredIndex(null)}
                />
                {(pt.isCurrent || pt.index === 0) && (
                  <text
                    x={cx}
                    y={CHART_HEIGHT - 3}
                    textAnchor={
                      points.length === 1
                        ? 'middle'
                        : pt.isCurrent
                          ? 'end'
                          : 'start'
                    }
                    className={`text-[10px] font-mono ${
                      pt.isCurrent ? 'fill-slate-800 font-semibold' : 'fill-slate-400'
                    }`}
                  >
                    {pt.label}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Inline Inspection Bar */}
      <div className="min-h-[18px] flex items-center justify-between text-xs text-slate-500">
        {activePoint ? (
          <span className="font-mono tabular-nums text-slate-700">
            {activePoint.label} · {activePoint.score}/10 · {activePoint.tone} (
            {activePoint.relationship})
          </span>
        ) : previousEntries.length === 0 ? (
          <span>
            Run additional drafts to build your historical aggression trendline and average.
          </span>
        ) : (
          <span>
            Hover or focus any point to inspect prior draft scores vs. your {historicalAverage?.toFixed(1)} average.
          </span>
        )}
      </div>
    </div>
  );
}
