import { useState } from 'react';
import type { ShapExplanation } from '../types';

// Waterfall filtering thresholds
const PCT_THRESHOLD = 5;   // minimum contribution_pct to appear as its own bar
const MAX_BARS = 8;        // cap on individual feature bars

// SVG layout constants
const MARGIN_LEFT = 164;
const MARGIN_RIGHT = 64;
const SVG_WIDTH = 700;
const CHART_WIDTH = SVG_WIDTH - MARGIN_LEFT - MARGIN_RIGHT; // 472
const PADDING_TOP = 20;
const ROW_HEIGHT = 42;
const BAR_HEIGHT = 26;
const BAR_Y_OFFSET = (ROW_HEIGHT - BAR_HEIGHT) / 2; // 8
const AXIS_AREA = 58;

// Colors
const RISK_COLOR      = '#EF4444';
const PROTECTIVE_COLOR= '#10B981';
const OTHERS_COLOR    = '#94A3B8';
const BASE_COLOR      = '#6366F1';
const PRED_COLOR      = '#1D4ED8';

interface WaterfallBar {
  label: string;
  shap: number;
  start: number;
  end: number;
  pct: number;
  direction: 'risk' | 'protective' | 'others';
  explanation: string;
}

interface WaterfallData {
  bars: WaterfallBar[];
  baseValue: number;
  shapPrediction: number;
  domainMin: number;
  domainMax: number;
}

function buildWaterfallData(explanation: ShapExplanation): WaterfallData | null {
  const { feature_contributions, base_value } = explanation;

  // Select top features by threshold, cap at MAX_BARS
  const topN = feature_contributions
    .filter(f => f.contribution_pct >= PCT_THRESHOLD)
    .slice(0, MAX_BARS);

  if (topN.length < 2) return null;

  const topNFeatures = new Set(topN.map(f => f.feature));
  const rest = feature_contributions.filter(f => !topNFeatures.has(f.feature));

  // Build cumulative bars
  const bars: WaterfallBar[] = [];
  let cumulative = base_value;

  for (const f of topN) {
    bars.push({
      label: f.display_name,
      shap: f.shap_value,
      start: cumulative,
      end: cumulative + f.shap_value,
      pct: f.contribution_pct,
      direction: f.direction,
      explanation: f.explanation,
    });
    cumulative += f.shap_value;
  }

  // Aggregate remaining features into a single "Others" bar
  if (rest.length > 0) {
    const othersShap = rest.reduce((s, f) => s + f.shap_value, 0);
    if (Math.abs(othersShap) > 1e-6) {
      const count = rest.length;
      bars.push({
        label: `${count} other${count > 1 ? 's' : ''}`,
        shap: othersShap,
        start: cumulative,
        end: cumulative + othersShap,
        pct: rest.reduce((s, f) => s + f.contribution_pct, 0),
        direction: 'others',
        explanation: `${count} additional factor${count > 1 ? 's' : ''} combined (${
          othersShap >= 0 ? '+' : ''
        }${(othersShap * 100).toFixed(1)}%)`,
      });
      cumulative += othersShap;
    }
  }

  const shapPrediction = cumulative;

  // Compute a tight x-domain around the actual data
  const allPoints = [base_value, ...bars.flatMap(b => [b.start, b.end]), shapPrediction];
  const rawMin = Math.min(...allPoints);
  const rawMax = Math.max(...allPoints);
  const pad = Math.max((rawMax - rawMin) * 0.08, 0.015);
  const domainMin = Math.max(0, rawMin - pad);
  const domainMax = Math.min(1, rawMax + pad);

  return { bars, baseValue: base_value, shapPrediction, domainMin, domainMax };
}

function toX(v: number, domainMin: number, domainMax: number): number {
  return MARGIN_LEFT + ((v - domainMin) / (domainMax - domainMin)) * CHART_WIDTH;
}

function colorFor(direction: WaterfallBar['direction']): string {
  if (direction === 'risk')       return RISK_COLOR;
  if (direction === 'protective') return PROTECTIVE_COLOR;
  return OTHERS_COLOR;
}

interface Props {
  explanation: ShapExplanation;
}

const ShapWaterfallChart = ({ explanation }: Props) => {
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    bar: WaterfallBar;
  } | null>(null);

  if (explanation.error) return null;

  const data = buildWaterfallData(explanation);
  if (!data) return null;

  const { bars, baseValue, shapPrediction, domainMin, domainMax } = data;
  const scale = (v: number) => toX(v, domainMin, domainMax);

  const totalHeight = PADDING_TOP + bars.length * ROW_HEIGHT + AXIS_AREA;
  const chartBottom = PADDING_TOP + bars.length * ROW_HEIGHT;
  const baseX = scale(baseValue);
  const predX = scale(shapPrediction);

  // Axis ticks at 10% intervals within domain
  const ticks: number[] = [];
  const tickStep = 0.1;
  for (
    let t = Math.ceil(domainMin / tickStep) * tickStep;
    t <= domainMax + 0.001;
    t += tickStep
  ) {
    ticks.push(parseFloat(t.toFixed(1)));
  }

  return (
    <div className="relative w-full">
      <svg
        viewBox={`0 0 ${SVG_WIDTH} ${totalHeight}`}
        width="100%"
        style={{ display: 'block', overflow: 'visible' }}
        aria-label="SHAP waterfall chart"
      >
        {/* Gridlines at tick positions */}
        {ticks.map(t => (
          <line
            key={t}
            x1={scale(t)} y1={PADDING_TOP}
            x2={scale(t)} y2={chartBottom}
            stroke="#E2E8F0" strokeWidth="1"
          />
        ))}

        {/* Base value reference line (dashed indigo) */}
        <line
          x1={baseX} y1={PADDING_TOP}
          x2={baseX} y2={chartBottom}
          stroke={BASE_COLOR} strokeWidth="1.5"
          strokeDasharray="5 4" opacity="0.65"
        />

        {/* Final prediction reference line (solid blue) */}
        <line
          x1={predX} y1={PADDING_TOP}
          x2={predX} y2={chartBottom}
          stroke={PRED_COLOR} strokeWidth="2" opacity="0.85"
        />

        {/* Feature bars, labels, and connectors */}
        {bars.map((bar, i) => {
          const rowTopY = PADDING_TOP + i * ROW_HEIGHT;
          const barY = rowTopY + BAR_Y_OFFSET;
          const textMidY = rowTopY + ROW_HEIGHT / 2 + 5;
          const x1 = scale(bar.start);
          const x2 = scale(bar.end);
          const barLeft = Math.min(x1, x2);
          const barWidth = Math.max(Math.abs(x2 - x1), 2);
          const color = colorFor(bar.direction);
          const nextBar = bars[i + 1];

          return (
            <g key={`${bar.label}-${i}`}>
              {/* Dashed vertical connector to next bar's start */}
              {nextBar && (
                <line
                  x1={x2} y1={barY + BAR_HEIGHT}
                  x2={x2} y2={rowTopY + ROW_HEIGHT + BAR_Y_OFFSET}
                  stroke="#CBD5E1" strokeWidth="1" strokeDasharray="3 3"
                />
              )}

              {/* The bar itself */}
              <rect
                x={barLeft} y={barY}
                width={barWidth} height={BAR_HEIGHT}
                fill={color} fillOpacity={0.88} rx={4}
                style={{ cursor: 'pointer' }}
                onMouseEnter={e => setTooltip({ x: e.clientX, y: e.clientY, bar })}
                onMouseMove={e => setTooltip({ x: e.clientX, y: e.clientY, bar })}
                onMouseLeave={() => setTooltip(null)}
              />

              {/* Feature label in left margin */}
              <text
                x={MARGIN_LEFT - 10}
                y={textMidY}
                textAnchor="end"
                fill="#475569"
                fontSize={12}
                fontFamily="system-ui, sans-serif"
              >
                {bar.label.length > 20 ? `${bar.label.slice(0, 19)}…` : bar.label}
              </text>

              {/* SHAP value to the right of the bar */}
              <text
                x={Math.max(x1, x2) + 6}
                y={textMidY}
                textAnchor="start"
                fill={color}
                fontSize={11}
                fontWeight="600"
                fontFamily="system-ui, sans-serif"
              >
                {bar.shap >= 0 ? '+' : ''}{(bar.shap * 100).toFixed(1)}%
              </text>
            </g>
          );
        })}

        {/* Axis baseline */}
        <line
          x1={MARGIN_LEFT} y1={chartBottom}
          x2={SVG_WIDTH - MARGIN_RIGHT} y2={chartBottom}
          stroke="#CBD5E1" strokeWidth="1"
        />

        {/* Tick marks and probability labels */}
        {ticks.map(t => (
          <g key={`tick-${t}`}>
            <line
              x1={scale(t)} y1={chartBottom}
              x2={scale(t)} y2={chartBottom + 5}
              stroke="#CBD5E1" strokeWidth="1"
            />
            <text
              x={scale(t)} y={chartBottom + 18}
              textAnchor="middle"
              fill="#94A3B8" fontSize={11}
              fontFamily="system-ui, sans-serif"
            >
              {Math.round(t * 100)}%
            </text>
          </g>
        ))}

        {/* Base value annotation below axis */}
        <text
          x={baseX} y={chartBottom + 36}
          textAnchor="middle"
          fill={BASE_COLOR} fontSize={10}
          fontFamily="system-ui, sans-serif"
        >
          Base {Math.round(baseValue * 100)}%
        </text>

        {/* Prediction annotation below axis */}
        <text
          x={predX} y={chartBottom + 36}
          textAnchor="middle"
          fill={PRED_COLOR} fontSize={10}
          fontWeight="600"
          fontFamily="system-ui, sans-serif"
        >
          RF {Math.round(shapPrediction * 100)}%
        </text>
      </svg>

      {/* Hover tooltip rendered at cursor position */}
      {tooltip && (
        <div
          style={{
            position: 'fixed',
            left: tooltip.x + 14,
            top: tooltip.y - 48,
            zIndex: 50,
            pointerEvents: 'none',
          }}
          className="bg-white shadow-xl rounded-xl p-3 border border-slate-200 max-w-xs"
        >
          <p className="font-semibold text-slate-800 text-sm">{tooltip.bar.label}</p>
          <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
            {tooltip.bar.explanation}
          </p>
          <p
            className={`text-xs font-semibold mt-2 ${
              tooltip.bar.shap >= 0 ? 'text-rose-600' : 'text-emerald-600'
            }`}
          >
            {tooltip.bar.shap >= 0 ? '▲' : '▼'}{' '}
            {Math.abs(tooltip.bar.shap * 100).toFixed(2)}% &nbsp;·&nbsp;
            {tooltip.bar.pct.toFixed(1)}% of total
          </p>
        </div>
      )}
    </div>
  );
};

export default ShapWaterfallChart;
