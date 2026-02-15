import { useState } from 'react';
import {
  FileText,
  ChevronDown,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Sparkles,
  TrendingUp,
  Activity,
  Zap,
  Clock,
  Target,
  Save,
  FileDown,
  Check,
} from 'lucide-react';
import type {
  ResultType,
  AnalyzeResponse,
  ManualInputResponse,
  ClassificationResult,
  TestType,
  ClassificationType,
  SaveAnalysisRequest,
} from '../types';
import { TEST_TYPE_LABELS } from '../types';
import { saveAnalysis } from '../services/api';
import { API_BASE_URL } from '../services/api';
import GaugeChart from './GaugeChart';
import RiskAssessment from './RiskAssessment';

interface ResultsDisplayProps {
  result: ResultType;
}

const ResultsDisplay = ({ result }: ResultsDisplayProps) => {
  const showSaveBar = result.type !== 'analyze' || result.data.is_valid_report;

  return (
    <div className="space-y-6">
      {result.type === 'analyze' && <AnalyzeResultsDisplay data={result.data} />}
      {result.type === 'manual' && <ManualResultDisplay data={result.data} />}
      {result.type === 'risk' && <RiskAssessment result={result.data} />}
      {showSaveBar && <SaveBar result={result} />}
    </div>
  );
};

// ============================================
// Save & Download Bar
// ============================================
const SaveBar = ({ result }: { result: ResultType }) => {
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true);
    const payload = buildSavePayload(result);
    const res = await saveAnalysis(payload);
    if (res.success && res.data) {
      setSavedId(res.data.id);
    }
    setSaving(false);
  };

  return (
    <div className="flex items-center justify-end gap-2 pt-2">
      {!savedId ? (
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:border-slate-300 disabled:opacity-50 transition-colors"
        >
          <Save className="w-3.5 h-3.5" />
          {saving ? 'Saving...' : 'Save to History'}
        </button>
      ) : (
        <>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-emerald-600 rounded-lg border border-emerald-200 ">
            <Check className="w-3.5 h-3.5" />
            Saved
          </span>
          <a
            href={`${API_BASE_URL}/api/report/pdf/${savedId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:border-slate-300 transition-colors"
          >
            <FileDown className="w-3.5 h-3.5" />
            Download PDF
          </a>
        </>
      )}
    </div>
  );
};

function buildSavePayload(result: ResultType): SaveAnalysisRequest {
  if (result.type === 'manual') {
    const c = result.data.classification;
    return {
      analysis_type: 'manual',
      input_data: result.data.input,
      result_data: result.data,
      test_type: c.test_type,
      glucose_value: c.value,
      classification: c.classification,
    };
  }
  if (result.type === 'risk') {
    const d = result.data;
    return {
      analysis_type: 'risk',
      input_data: d.input_values,
      result_data: d,
      glucose_value: d.input_values.glucose,
      risk_category: d.risk_category,
      risk_percentage: d.risk_percentage,
    };
  }
  // OCR
  const d = result.data;
  const firstClassification = d.classifications?.[0]?.classification;
  return {
    analysis_type: 'ocr',
    input_data: { detected_values: d.detected_values },
    result_data: d,
    test_type: firstClassification?.test_type,
    glucose_value: firstClassification?.value,
    classification: firstClassification?.classification,
  };
}

// ============================================
// Status Badge Component
// ============================================
interface StatusBadgeProps {
  classification: ClassificationType;
  size?: 'sm' | 'md' | 'lg';
}

const StatusBadge = ({ classification, size = 'md' }: StatusBadgeProps) => {
  const config = {
    Normal: {
      bg: 'bg-gradient-to-r from-emerald-50 to-emerald-100',
      border: 'border-emerald-200',
      text: 'text-emerald-700',
      icon: <CheckCircle2 className="w-4 h-4" />,
      glow: 'shadow-emerald-100',
    },
    Low: {
      bg: 'bg-gradient-to-r from-amber-50 to-amber-100',
      border: 'border-amber-200',
      text: 'text-amber-700',
      icon: <AlertCircle className="w-4 h-4" />,
      glow: 'shadow-amber-100',
    },
    Prediabetes: {
      bg: 'bg-gradient-to-r from-amber-50 to-orange-100',
      border: 'border-amber-200',
      text: 'text-amber-700',
      icon: <AlertCircle className="w-4 h-4" />,
      glow: 'shadow-amber-100',
    },
    'Needs Monitoring': {
      bg: 'bg-gradient-to-r from-amber-50 to-amber-100',
      border: 'border-amber-200',
      text: 'text-amber-700',
      icon: <AlertCircle className="w-4 h-4" />,
      glow: 'shadow-amber-100',
    },
    Diabetes: {
      bg: 'bg-gradient-to-r from-rose-50 to-rose-100',
      border: 'border-rose-200',
      text: 'text-rose-700',
      icon: <AlertTriangle className="w-4 h-4" />,
      glow: 'shadow-rose-100',
    },
  }[classification];

  const sizeClasses = {
    sm: 'px-2.5 py-1 text-xs gap-1',
    md: 'px-3.5 py-1.5 text-sm gap-1.5',
    lg: 'px-4 py-2 text-base gap-2',
  }[size];

  return (
    <span
      className={`inline-flex items-center font-semibold rounded-full border ${config.bg} ${config.border} ${config.text} ${sizeClasses} shadow-sm ${config.glow}`}
    >
      {config.icon}
      {classification}
    </span>
  );
};

// ============================================
// OCR Analysis Results - Medical Intelligence Report
// ============================================
interface AnalyzeResultsDisplayProps {
  data: AnalyzeResponse;
}

const AnalyzeResultsDisplay = ({ data }: AnalyzeResultsDisplayProps) => {
  const [showExtractedText, setShowExtractedText] = useState(false);

  if (!data.is_valid_report) {
    return (
      <div className="animate-fade-in-up">
        <div className="card-elevated p-8">
          <div className="flex items-start gap-5">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-100 to-amber-50 flex items-center justify-center flex-shrink-0 shadow-sm">
              <AlertCircle className="w-7 h-7 text-amber-600" />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-slate-800 mb-2">
                Unable to Process Report
              </h3>
              <p className="text-slate-600 leading-relaxed mb-4">
                {data.validation?.message || data.message || 'This image does not appear to be a valid glucose report.'}
              </p>
              <div className="flex items-center gap-2 text-sm text-amber-600">
                <Zap className="w-4 h-4" />
                <span>Tip: Ensure the image is clear and contains glucose test results</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Report Header - Intelligence Summary */}
      <div className="card-elevated overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-700 p-6 text-white">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center">
                <Sparkles className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-semibold">Analysis Complete</h2>
                <p className="text-blue-100 text-sm mt-0.5">
                  {data.detected_values.length} glucose value{data.detected_values.length !== 1 ? 's' : ''} detected
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 bg-white/10 backdrop-blur rounded-full px-3 py-1.5">
              <Clock className="w-4 h-4 text-blue-200" />
              <span className="text-sm text-blue-100">Just now</span>
            </div>
          </div>
        </div>
        <div className="p-6 bg-gradient-to-b from-slate-50 to-white">
          <p className="text-slate-700 leading-relaxed">{data.summary}</p>
        </div>
      </div>

      {/* Classification Cards */}
      {data.classifications.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 px-1">
            <Activity className="w-5 h-5 text-slate-400" />
            <h3 className="text-label">Test Results</h3>
          </div>
          <div className="grid gap-4">
            {data.classifications.map((item, index) => (
              <ClassificationCard
                key={index}
                classification={item.classification}
                confidence={item.detected.confidence}
                index={index}
              />
            ))}
          </div>
        </div>
      )}

      {/* Extracted Text - Collapsible */}
      {data.extracted_text && (
        <div className="card overflow-hidden">
          <button
            onClick={() => setShowExtractedText(!showExtractedText)}
            className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center">
                <FileText className="w-4 h-4 text-slate-500" />
              </div>
              <div className="text-left">
                <span className="text-sm font-medium text-slate-700">Extracted Text</span>
                <p className="text-xs text-slate-500">View raw OCR output</p>
              </div>
            </div>
            <ChevronDown
              className={`w-5 h-5 text-slate-400 transition-transform ${
                showExtractedText ? 'rotate-180' : ''
              }`}
            />
          </button>
          {showExtractedText && (
            <div className="px-4 pb-4">
              <pre className="text-xs text-slate-600 whitespace-pre-wrap bg-slate-50 p-4 rounded-xl border border-slate-100 max-h-48 overflow-auto font-mono">
                {data.extracted_text}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ============================================
// Manual Input Results
// ============================================
interface ManualResultDisplayProps {
  data: ManualInputResponse;
}

const ManualResultDisplay = ({ data }: ManualResultDisplayProps) => {
  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Input confirmation */}
      <div className="flex items-center gap-3 px-1">
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Target className="w-4 h-4" />
          <span>Analyzed:</span>
        </div>
        <span className="text-sm font-medium text-slate-700">
          {TEST_TYPE_LABELS[data.input.test_type]} · {data.input.value} {data.input.unit}
        </span>
      </div>

      {/* Result Card */}
      <ClassificationCard classification={data.classification} />
    </div>
  );
};

// ============================================
// Premium Classification Card
// ============================================
interface ClassificationCardProps {
  classification: ClassificationResult;
  confidence?: number;
  index?: number;
}

const ClassificationCard = ({ classification, confidence, index = 0 }: ClassificationCardProps) => {
  const severityConfig = {
    Normal: {
      gradient: 'from-emerald-500 to-teal-600',
      bg: 'bg-gradient-to-br from-emerald-50 to-teal-50',
      border: 'border-emerald-100',
      glow: '0 0 40px rgba(16, 185, 129, 0.15)',
    },
    Low: {
      gradient: 'from-amber-500 to-orange-600',
      bg: 'bg-gradient-to-br from-amber-50 to-orange-50',
      border: 'border-amber-100',
      glow: '0 0 40px rgba(245, 158, 11, 0.15)',
    },
    Prediabetes: {
      gradient: 'from-amber-500 to-orange-600',
      bg: 'bg-gradient-to-br from-amber-50 to-orange-50',
      border: 'border-amber-100',
      glow: '0 0 40px rgba(245, 158, 11, 0.15)',
    },
    'Needs Monitoring': {
      gradient: 'from-amber-500 to-orange-600',
      bg: 'bg-gradient-to-br from-amber-50 to-orange-50',
      border: 'border-amber-100',
      glow: '0 0 40px rgba(245, 158, 11, 0.15)',
    },
    Diabetes: {
      gradient: 'from-rose-500 to-red-600',
      bg: 'bg-gradient-to-br from-rose-50 to-red-50',
      border: 'border-rose-100',
      glow: '0 0 40px rgba(239, 68, 68, 0.15)',
    },
  }[classification.classification];

  return (
    <div
      className={`card-elevated overflow-hidden animate-fade-in-up`}
      style={{
        animationDelay: `${index * 0.1}s`,
        boxShadow: severityConfig.glow,
      }}
    >
      {/* Gradient accent bar */}
      <div className={`h-1 bg-gradient-to-r ${severityConfig.gradient}`} />

      <div className="p-6">
        <div className="flex flex-col lg:flex-row lg:items-center gap-6">
          {/* Gauge Section */}
          <div className="flex justify-center lg:justify-start">
            <GaugeChart
              value={classification.value}
              testType={classification.test_type as TestType}
              unit={classification.unit}
              label={classification.display_name}
              size="lg"
              variant="default"
            />
          </div>

          {/* Info Section */}
          <div className="flex-1 space-y-4">
            {/* Status Row */}
            <div className="flex flex-wrap items-center gap-3">
              <StatusBadge classification={classification.classification} size="lg" />
              {confidence !== undefined && confidence > 0 && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-sm font-medium">
                  <Zap className="w-3.5 h-3.5" />
                  {(confidence * 100).toFixed(0)}% confidence
                </span>
              )}
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-slate-50/80 border border-slate-100">
                <p className="text-label mb-1">Your Value</p>
                <p className="text-2xl font-bold text-slate-800">
                  {classification.value}
                  <span className="text-base font-normal text-slate-400 ml-1">
                    {classification.unit}
                  </span>
                </p>
              </div>
              <div className="p-4 rounded-xl bg-slate-50/80 border border-slate-100">
                <p className="text-label mb-1">Normal Range</p>
                <p className="text-2xl font-bold text-emerald-600">
                  {classification.normal_range.min}-{classification.normal_range.max}
                  <span className="text-base font-normal text-slate-400 ml-1">
                    {classification.unit}
                  </span>
                </p>
              </div>
            </div>

            {/* Recommendation */}
            <div className={`p-4 rounded-xl ${severityConfig.bg} border ${severityConfig.border}`}>
              <div className="flex items-start gap-3">
                <TrendingUp className="w-5 h-5 text-slate-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-slate-700 mb-1">Recommendation</p>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    {classification.recommendation}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResultsDisplay;
