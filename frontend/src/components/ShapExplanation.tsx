import { useEffect, useState, useRef } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Cell,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { Lightbulb, TrendingUp, ShieldCheck, ArrowUp, ArrowDown } from 'lucide-react';
import type { ShapExplanation as ShapExplanationType } from '../types';
import ShapWaterfallChart from './ShapWaterfallChart';

type ChartView = 'waterfall' | 'bar';

interface ShapExplanationProps {
  explanation: ShapExplanationType;
}

interface ChartDataItem {
  name: string;
  value: number;
  fill: string;
  pct: number;
  explanation: string;
  direction: 'risk' | 'protective';
}

const ShapExplanation = ({ explanation }: ShapExplanationProps) => {
  const [isVisible, setIsVisible] = useState(false);
  const [chartView, setChartView] = useState<ChartView>('waterfall');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setIsVisible(true);
      },
      { threshold: 0.1 }
    );
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  if (explanation.error) return null;

  const chartData: ChartDataItem[] = explanation.feature_contributions.map((fc) => ({
    name: fc.display_name,
    value: fc.direction === 'risk' ? fc.contribution_pct : -fc.contribution_pct,
    fill: fc.direction === 'risk' ? '#EF4444' : '#10B981',
    pct: fc.contribution_pct,
    explanation: fc.explanation,
    direction: fc.direction,
  }));

  return (
    <div
      ref={containerRef}
      className={`card-elevated overflow-hidden transition-all duration-700 ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
      }`}
    >
      {/* Header */}
      <div className="bg-gradient-to-r from-violet-500 to-purple-600 p-6 text-white">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center">
              <Lightbulb className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-semibold">Why This Prediction?</h3>
              <p className="text-white/80 text-sm mt-0.5">
                SHAP-based explainability for each health factor
              </p>
            </div>
          </div>
          {/* Chart view toggle */}
          <div className="flex items-center gap-1 bg-white/15 rounded-lg p-1">
            <button
              onClick={() => setChartView('waterfall')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                chartView === 'waterfall'
                  ? 'bg-white text-violet-700 shadow-sm'
                  : 'text-white/80 hover:text-white hover:bg-white/10'
              }`}
            >
              Waterfall
            </button>
            <button
              onClick={() => setChartView('bar')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                chartView === 'bar'
                  ? 'bg-white text-violet-700 shadow-sm'
                  : 'text-white/80 hover:text-white hover:bg-white/10'
              }`}
            >
              Bar Chart
            </button>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Plain English Summary */}
        <div className="p-4 rounded-xl bg-gradient-to-r from-violet-50 to-purple-50 border border-violet-100">
          <p className="text-slate-700 leading-relaxed">
            {explanation.plain_english_summary}
          </p>
        </div>

        {/* Chart: waterfall (default) or bar chart (toggle fallback) */}
        <div>
          <h4 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">
            Factor Contribution Breakdown
          </h4>

          {chartView === 'waterfall' ? (
            <ShapWaterfallChart explanation={explanation} />
          ) : (
            <>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={chartData}
                    layout="vertical"
                    margin={{ top: 5, right: 30, left: 120, bottom: 5 }}
                  >
                    <XAxis
                      type="number"
                      domain={[-100, 100]}
                      tickFormatter={(v: number) => `${Math.abs(v)}%`}
                      tick={{ fill: '#94A3B8', fontSize: 12 }}
                      axisLine={{ stroke: '#E2E8F0' }}
                      tickLine={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      tick={{ fill: '#475569', fontSize: 13 }}
                      axisLine={false}
                      tickLine={false}
                      width={115}
                    />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
                    <ReferenceLine x={0} stroke="#CBD5E1" strokeWidth={1} />
                    <Bar dataKey="value" radius={[4, 4, 4, 4]} barSize={24}>
                      {chartData.map((entry, index) => (
                        <Cell key={index} fill={entry.fill} fillOpacity={0.85} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="flex items-center justify-center gap-6 mt-2 text-sm text-slate-500">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm bg-emerald-500" />
                  Protective (lowers risk)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm bg-red-500" />
                  Risk (increases risk)
                </span>
              </div>
            </>
          )}
        </div>

        {/* Top Factors Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Risk Factors */}
          {explanation.top_risk_factors.length > 0 && (
            <div className="p-4 rounded-xl bg-gradient-to-br from-rose-50 to-red-50 border border-rose-200">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="w-4 h-4 text-rose-600" />
                <h5 className="font-semibold text-rose-700 text-sm">Top Risk Factors</h5>
              </div>
              <div className="space-y-2">
                {explanation.top_risk_factors.map((f, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <ArrowUp className="w-3.5 h-3.5 text-rose-500 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-slate-700">{f.explanation}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Protective Factors */}
          {explanation.top_protective_factors.length > 0 && (
            <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200">
              <div className="flex items-center gap-2 mb-3">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <h5 className="font-semibold text-emerald-700 text-sm">Protective Factors</h5>
              </div>
              <div className="space-y-2">
                {explanation.top_protective_factors.map((f, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <ArrowDown className="w-3.5 h-3.5 text-emerald-500 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-slate-700">{f.explanation}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Custom Tooltip for the bar chart
const CustomTooltip = ({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: ChartDataItem }>;
}) => {
  if (!active || !payload?.[0]) return null;

  const data = payload[0].payload;
  return (
    <div className="bg-white shadow-lg rounded-xl p-3 border border-slate-200 max-w-xs">
      <p className="font-semibold text-slate-800 text-sm">{data.name}</p>
      <p className="text-sm text-slate-600 mt-1">{data.explanation}</p>
      <div className="flex items-center gap-1.5 mt-2">
        <span
          className={`inline-block w-2 h-2 rounded-full ${
            data.direction === 'risk' ? 'bg-red-500' : 'bg-emerald-500'
          }`}
        />
        <span className="text-xs font-medium text-slate-500">
          {data.pct}% contribution ({data.direction === 'risk' ? 'increases' : 'decreases'} risk)
        </span>
      </div>
    </div>
  );
};

export default ShapExplanation;
