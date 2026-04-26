import { useState, useEffect, useCallback, useRef } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceArea,
} from 'recharts';
import {
  Clock,
  Trash2,
  Activity,
  Shield,
  Scan,
  FlaskConical,
  ChevronLeft,
  ChevronRight,
  FileDown,
  Filter,
  BarChart3,
  TrendingUp,
  Inbox,
  Sparkles,
} from 'lucide-react';
import { getHistory, deleteAnalysis, getTrends, getInsight, API_BASE_URL } from '../services/api';
import type { AnalysisHistoryItem, TrendDataPoint, TrendInsight } from '../types';

const TYPE_CONFIG: Record<
  string,
  { label: string; icon: React.ReactNode; color: string; bg: string; border: string }
> = {
  ocr: {
    label: 'OCR Upload',
    icon: <Scan className="w-3.5 h-3.5" />,
    color: 'text-blue-700',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
  },
  manual: {
    label: 'Manual Input',
    icon: <FlaskConical className="w-3.5 h-3.5" />,
    color: 'text-emerald-700',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
  },
  risk: {
    label: 'Risk Assessment',
    icon: <Shield className="w-3.5 h-3.5" />,
    color: 'text-violet-700',
    bg: 'bg-violet-50',
    border: 'border-violet-200',
  },
};

const CLASSIFICATION_COLORS: Record<string, string> = {
  Normal: 'text-emerald-700 bg-emerald-50 border-emerald-200',
  Low: 'text-amber-700 bg-amber-50 border-amber-200',
  Prediabetes: 'text-amber-700 bg-amber-50 border-amber-200',
  'Needs Monitoring': 'text-amber-700 bg-amber-50 border-amber-200',
  Diabetes: 'text-rose-700 bg-rose-50 border-rose-200',
};

const RISK_COLORS: Record<string, string> = {
  Low: 'text-emerald-700 bg-emerald-50 border-emerald-200',
  Moderate: 'text-amber-700 bg-amber-50 border-amber-200',
  High: 'text-rose-700 bg-rose-50 border-rose-200',
};

const PAGE_SIZE = 10;

const History = () => {
  const [analyses, setAnalyses] = useState<AnalysisHistoryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [trendData, setTrendData] = useState<TrendDataPoint[]>([]);

  const [dateRange, setDateRange] = useState<{ start: string; end: string }>(() => {
    const end = new Date().toISOString().slice(0, 10);
    const start = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    return { start, end };
  });
  const [activePreset, setActivePreset] = useState<7 | 30 | 90 | null>(30);
  const [insight, setInsight] = useState<TrendInsight | null>(null);
  const [insightLoading, setInsightLoading] = useState(false);

  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchIdRef = useRef(0);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getHistory({
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
        type: typeFilter || undefined,
      });
      if (res.success && res.data) {
        setAnalyses(res.data.analyses);
        setTotal(res.data.total);
      }
    } finally {
      setLoading(false);
    }
  }, [page, typeFilter]);

  const fetchTrendsAndInsight = useCallback(async () => {
    const fetchId = ++fetchIdRef.current;
    setInsightLoading(true);
    setInsight(null);
    try {
      const [trendsRes, insightRes] = await Promise.all([
        getTrends({ start_date: dateRange.start, end_date: dateRange.end }),
        getInsight({ start_date: dateRange.start, end_date: dateRange.end }),
      ]);
      if (fetchId !== fetchIdRef.current) return;
      if (trendsRes.success && trendsRes.data) {
        setTrendData(trendsRes.data.data_points);
      }
      setInsight(insightRes.insight);
    } finally {
      if (fetchId === fetchIdRef.current) setInsightLoading(false);
    }
  }, [dateRange]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  useEffect(() => {
    if (dateRange.start > dateRange.end) return;
    fetchTrendsAndInsight();
  }, [fetchTrendsAndInsight]);

  const handleDelete = useCallback(async (id: string) => {
    setDeletingId(id);
    try {
      const res = await deleteAnalysis(id);
      if (res.success) {
        fetchHistory();
        fetchTrendsAndInsight();
      }
    } finally {
      setDeletingId(null);
    }
  }, [fetchHistory, fetchTrendsAndInsight]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  // Format trend data for recharts
  const chartData = trendData.map((pt) => ({
    ...pt,
    date: new Date(pt.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    dateRaw: pt.date,
  }));

  return (
    <div className="flex-1 min-h-screen bg-gradient-to-b from-slate-100 via-slate-50 to-white">
      {/* Hero Header */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-0 right-1/4 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-1/4 w-48 h-48 bg-purple-500/20 rounded-full blur-3xl" />
        </div>
        <div className="container mx-auto px-4 py-12 relative">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm px-4 py-2 rounded-full mb-4 border border-white/10">
              <Clock className="w-4 h-4 text-indigo-300" />
              <span className="text-sm font-medium text-indigo-100">Analysis History</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold mb-3">Your Results Over Time</h1>
            <p className="text-blue-100/80 text-lg max-w-xl mx-auto">
              Track trends, review past analyses, and download reports
            </p>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 max-w-5xl -mt-8 relative space-y-8">
        {/* Trend Chart */}
        <div className="card-elevated overflow-hidden">
          <div className="bg-gradient-to-r from-indigo-500 to-purple-600 p-5 text-white">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center">
                  <BarChart3 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">Glucose Trends</h3>
                  <p className="text-white/70 text-sm">{chartData.length} data points</p>
                </div>
              </div>
              {/* Date range controls */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Quick-select pills */}
                {([7, 30, 90] as const).map((d) => (
                  <button
                    key={d}
                    onClick={() => {
                      const end = new Date().toISOString().slice(0, 10);
                      const start = new Date(Date.now() - d * 24 * 60 * 60 * 1000)
                        .toISOString()
                        .slice(0, 10);
                      setDateRange({ start, end });
                      setActivePreset(d);
                    }}
                    className={`px-3 py-1 rounded-lg text-sm font-medium transition-all ${
                      activePreset === d
                        ? 'bg-white text-indigo-700'
                        : 'bg-white/10 text-white/80 hover:bg-white/20'
                    }`}
                  >
                    {d}d
                  </button>
                ))}
                {/* Date inputs */}
                <input
                  type="date"
                  aria-label="Start date"
                  value={dateRange.start}
                  max={dateRange.end}
                  onChange={(e) => {
                    setDateRange((r) => ({ ...r, start: e.target.value }));
                    setActivePreset(null);
                  }}
                  className="bg-white/10 text-white text-sm rounded-lg px-2 py-1 border border-white/20 focus:outline-none focus:ring-2 focus:ring-white/30"
                />
                <span className="text-white/60 text-sm">to</span>
                <input
                  type="date"
                  aria-label="End date"
                  value={dateRange.end}
                  min={dateRange.start}
                  max={new Date().toISOString().slice(0, 10)}
                  onChange={(e) => {
                    setDateRange((r) => ({ ...r, end: e.target.value }));
                    setActivePreset(null);
                  }}
                  className="bg-white/10 text-white text-sm rounded-lg px-2 py-1 border border-white/20 focus:outline-none focus:ring-2 focus:ring-white/30"
                />
                {dateRange.start > dateRange.end && (
                  <span className="text-rose-300 text-xs">Start must be before end</span>
                )}
              </div>
            </div>
          </div>
          <div className="p-6">
            {chartData.length > 0 ? (
              <>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                      {/* Reference zones: Normal (70-99), Prediabetes (100-125), Diabetes (126+) */}
                      <ReferenceArea y1={70} y2={99} fill="#10B981" fillOpacity={0.06} />
                      <ReferenceArea y1={100} y2={125} fill="#F59E0B" fillOpacity={0.06} />
                      <ReferenceArea y1={126} y2={300} fill="#EF4444" fillOpacity={0.06} />
                      <XAxis
                        dataKey="date"
                        tick={{ fill: '#94A3B8', fontSize: 12 }}
                        axisLine={{ stroke: '#E2E8F0' }}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fill: '#94A3B8', fontSize: 12 }}
                        axisLine={{ stroke: '#E2E8F0' }}
                        tickLine={false}
                        domain={['auto', 'auto']}
                        label={{
                          value: 'mg/dL',
                          angle: -90,
                          position: 'insideLeft',
                          style: { fill: '#94A3B8', fontSize: 11 },
                        }}
                      />
                      <Tooltip
                        contentStyle={{
                          borderRadius: '12px',
                          border: '1px solid #E2E8F0',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                        }}
                        labelStyle={{ fontWeight: 600 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="value"
                        stroke="#6366F1"
                        strokeWidth={2.5}
                        dot={{ fill: '#6366F1', r: 4, strokeWidth: 2, stroke: '#fff' }}
                        activeDot={{ r: 6, stroke: '#6366F1', strokeWidth: 2 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                {/* Insight banner */}
                {insightLoading ? (
                  <div className="mt-4 h-10 bg-indigo-50 rounded-xl animate-pulse" />
                ) : insight && insight.count >= 2 ? (
                  <div className="mt-4 flex items-start gap-3 bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-3">
                    <Sparkles className="w-4 h-4 text-indigo-500 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-indigo-800">{insight.sentence}</p>
                  </div>
                ) : null}
                <div className="flex items-center justify-center gap-6 mt-3 text-xs text-slate-500">
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-sm bg-emerald-500/20 border border-emerald-300" />
                    Normal (70-99)
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-sm bg-amber-500/20 border border-amber-300" />
                    Prediabetes (100-125)
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-sm bg-rose-500/20 border border-rose-300" />
                    Diabetes (126+)
                  </span>
                </div>
              </>
            ) : (
              <div className="h-64 flex flex-col items-center justify-center">
                <TrendingUp className="w-10 h-10 text-slate-300 mb-3" />
                <p className="font-semibold text-slate-600">No glucose data</p>
                <p className="text-sm text-slate-400 mt-1">Analyses with glucose values will appear here.</p>
              </div>
            )}
          </div>
        </div>

        {/* History Table */}
        <div className="card-elevated overflow-hidden">
          {/* Header with filters */}
          <div className="p-5 border-b border-slate-100">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-100 to-slate-50 flex items-center justify-center">
                  <Activity className="w-5 h-5 text-slate-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-800">Past Analyses</h3>
                  <p className="text-xs text-slate-500">{total} total records</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-slate-400" />
                <select
                  value={typeFilter}
                  onChange={(e) => {
                    setTypeFilter(e.target.value);
                    setPage(0);
                  }}
                  className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200"
                >
                  <option value="">All Types</option>
                  <option value="ocr">OCR Upload</option>
                  <option value="manual">Manual Input</option>
                  <option value="risk">Risk Assessment</option>
                </select>
              </div>
            </div>
          </div>

          {/* Table body */}
          {loading ? (
            <div className="divide-y divide-slate-100">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="p-4 flex items-center gap-4">
                  <div className="skeleton w-9 h-9 rounded-lg flex-shrink-0" />
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="skeleton h-4 w-32 rounded" />
                    <div className="skeleton h-3 w-48 rounded" />
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <div className="skeleton w-8 h-8 rounded-lg" />
                    <div className="skeleton w-8 h-8 rounded-lg" />
                  </div>
                </div>
              ))}
            </div>
          ) : analyses.length === 0 ? (
            <div className="p-12 flex flex-col items-center justify-center">
              <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
                <Inbox className="w-8 h-8 text-slate-400" />
              </div>
              <h4 className="font-semibold text-slate-700 mb-1">No analyses yet</h4>
              <p className="text-sm text-slate-500 text-center max-w-xs">
                Save your analysis results to build a history and track trends over time.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {analyses.map((item) => {
                const typeConf = TYPE_CONFIG[item.analysis_type] || TYPE_CONFIG.manual;
                return (
                  <div
                    key={item.id}
                    className="p-4 flex items-center gap-4 hover:bg-slate-50/50 transition-colors"
                  >
                    {/* Type badge */}
                    <div
                      className={`w-9 h-9 rounded-lg ${typeConf.bg} border ${typeConf.border} flex items-center justify-center flex-shrink-0`}
                    >
                      <span className={typeConf.color}>{typeConf.icon}</span>
                    </div>

                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-slate-800">
                          {typeConf.label}
                        </span>
                        {item.test_type && (
                          <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                            {item.test_type}
                          </span>
                        )}
                        {item.classification && (
                          <span
                            className={`text-xs font-medium px-2 py-0.5 rounded border ${
                              CLASSIFICATION_COLORS[item.classification] || 'text-slate-600 bg-slate-50 border-slate-200'
                            }`}
                          >
                            {item.classification}
                          </span>
                        )}
                        {item.risk_category && (
                          <span
                            className={`text-xs font-medium px-2 py-0.5 rounded border ${
                              RISK_COLORS[item.risk_category] || ''
                            }`}
                          >
                            {item.risk_category} Risk
                            {item.risk_percentage != null && ` (${item.risk_percentage.toFixed(0)}%)`}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {new Date(item.created_at).toLocaleString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                        {item.glucose_value != null && (
                          <span className="ml-2">
                            &middot; {item.glucose_value} mg/dL
                          </span>
                        )}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <a
                        href={`${API_BASE_URL}/api/report/pdf/${item.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                        title="Download PDF"
                      >
                        <FileDown className="w-4 h-4" />
                      </a>
                      <button
                        onClick={() => handleDelete(item.id)}
                        disabled={deletingId === item.id}
                        className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors disabled:opacity-50"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="p-4 border-t border-slate-100 flex items-center justify-between">
              <p className="text-sm text-slate-500">
                Page {page + 1} of {totalPages}
              </p>
              <div className="flex gap-1.5">
                <button
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default History;
