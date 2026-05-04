import { useEffect, useState, useRef } from 'react';
import {
  Shield,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Info,
  Brain,
  Activity,
  Cpu,
  Database,
  Calendar,
  Sparkles,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { RiskPredictionResponse, RiskPredictionWithExplanation, ConfidenceLevel } from '../types';
import { CONFIDENCE_LABELS } from '../types';
import { translateRisk } from '../i18n/classificationMap';
import ShapExplanation from './ShapExplanation';
import ConfidenceDisplay from './ConfidenceDisplay';

interface RiskAssessmentProps {
  result: RiskPredictionResponse | RiskPredictionWithExplanation;
}

const RISK_CONFIG = {
  Low: {
    gradient: 'from-emerald-500 to-teal-600',
    bg: 'bg-gradient-to-br from-emerald-50 to-teal-50',
    border: 'border-emerald-200',
    text: 'text-emerald-700',
    stroke: '#10B981',
    glow: 'rgba(16, 185, 129, 0.2)',
    icon: CheckCircle,
  },
  Moderate: {
    gradient: 'from-amber-500 to-orange-600',
    bg: 'bg-gradient-to-br from-amber-50 to-orange-50',
    border: 'border-amber-200',
    text: 'text-amber-700',
    stroke: '#F59E0B',
    glow: 'rgba(245, 158, 11, 0.2)',
    icon: AlertCircle,
  },
  High: {
    gradient: 'from-rose-500 to-red-600',
    bg: 'bg-gradient-to-br from-rose-50 to-red-50',
    border: 'border-rose-200',
    text: 'text-rose-700',
    stroke: '#EF4444',
    glow: 'rgba(239, 68, 68, 0.2)',
    icon: Shield,
  },
};

const RiskAssessment = ({ result }: RiskAssessmentProps) => {
  const { t } = useTranslation();
  const [animatedPercentage, setAnimatedPercentage] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const config = RISK_CONFIG[result.risk_category];
  const RiskIcon = config.icon;

  // Intersection Observer for viewport detection
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.2 }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, []);

  // Animate percentage with easing
  useEffect(() => {
    if (!isVisible) return;

    const duration = 1800;
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 4);
      setAnimatedPercentage(result.risk_percentage * eased);

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, [result.risk_percentage, isVisible]);

  const getConfidenceBars = (level: ConfidenceLevel) => {
    const bars = level === 'high' ? 3 : level === 'moderate' ? 2 : 1;
    return (
      <div className="flex gap-1 items-end">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className={`w-1.5 rounded-full transition-all duration-500 ${
              i <= bars ? 'bg-linear-to-t from-blue-500 to-blue-400' : 'bg-slate-200'
            }`}
            style={{
              height: `${6 + i * 5}px`,
              transitionDelay: `${i * 100}ms`,
            }}
          />
        ))}
      </div>
    );
  };

  // Calculate stroke dasharray for circular progress
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (animatedPercentage / 100) * circumference;

  return (
    <div ref={containerRef} className="space-y-6 animate-fade-in-up">
      {/* Main Risk Assessment Card */}
      <div
        className="card-elevated overflow-hidden"
        style={{ boxShadow: `0 0 60px ${config.glow}` }}
      >
        {/* Gradient Header */}
        <div className={`bg-gradient-to-r ${config.gradient} p-6 text-white`}>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">{t('riskAssessment.riskCategory')}</h2>
              <p className="text-white/80 text-sm mt-0.5">
                {result.factors_provided.length} {t('riskAssessment.factorsAnalyzed')}
              </p>
            </div>
          </div>
        </div>

        {/* Risk Score Section */}
        <div className="p-8 bg-gradient-to-b from-slate-50 to-white">
          <div className="flex flex-col lg:flex-row items-center gap-8">
            {/* Circular Progress Gauge */}
            <div className="relative flex-shrink-0">
              <svg width="160" height="160" className="transform -rotate-90">
                <defs>
                  <linearGradient id="risk-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor={config.stroke} stopOpacity="0.8" />
                    <stop offset="100%" stopColor={config.stroke} />
                  </linearGradient>
                  <filter id="risk-glow" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="4" result="coloredBlur" />
                    <feMerge>
                      <feMergeNode in="coloredBlur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>
                {/* Background circle */}
                <circle
                  cx="80"
                  cy="80"
                  r={radius}
                  fill="none"
                  stroke="#E2E8F0"
                  strokeWidth="14"
                />
                {/* Progress circle */}
                <circle
                  cx="80"
                  cy="80"
                  r={radius}
                  fill="none"
                  stroke="url(#risk-gradient)"
                  strokeWidth="14"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  filter="url(#risk-glow)"
                  style={{
                    transition: 'stroke-dashoffset 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                  }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span
                  className="text-4xl font-bold tracking-tight"
                  style={{ color: config.stroke }}
                >
                  {animatedPercentage.toFixed(0)}
                </span>
                <span className="text-sm font-medium text-slate-400">percent</span>
              </div>
            </div>

            {/* Risk Details */}
            <div className="flex-1 text-center lg:text-left space-y-4">
              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-3">
                <span
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-full font-semibold text-lg ${config.bg} ${config.border} border ${config.text}`}
                >
                  <RiskIcon className="w-5 h-5" />
                  {translateRisk(result.risk_category, t)} {t('riskAssessment.risk')}
                </span>
                <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-100 text-slate-600 rounded-full text-sm font-medium">
                  {getConfidenceBars(result.confidence_level)}
                  <span className="ml-1">{CONFIDENCE_LABELS[result.confidence_level]}</span>
                </span>
              </div>

              <p className="text-slate-600 leading-relaxed text-lg">{result.risk_description}</p>

              {/* Quick Stats */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="p-3 rounded-xl bg-slate-50/80 border border-slate-100">
                  <p className="text-label mb-0.5">{t('riskAssessment.riskScore')}</p>
                  <p className="text-xl font-bold text-slate-800">
                    {(result.risk_probability * 100).toFixed(1)}%
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-slate-50/80 border border-slate-100">
                  <p className="text-label mb-0.5">{t('riskAssessment.factorsAnalyzed')}</p>
                  <p className="text-xl font-bold text-slate-800">
                    {result.factors_provided.length}
                    <span className="text-sm font-normal text-slate-400 ml-1">/ 8</span>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Factors Analysis */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Factors Provided */}
        <div className="card-elevated p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-100 to-emerald-50 flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h4 className="font-semibold text-slate-800">Factors Provided</h4>
              <p className="text-xs text-slate-500">{result.factors_provided.length} health metrics analyzed</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {result.factors_provided.map((factor, index) => (
              <span
                key={factor}
                className="px-3 py-1.5 bg-gradient-to-r from-emerald-50 to-emerald-100 text-emerald-700 text-sm font-medium rounded-lg border border-emerald-200 animate-fade-in-up"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                {factor}
              </span>
            ))}
          </div>
        </div>

        {/* Missing Factors */}
        {result.factors_missing.length > 0 && (
          <div className="card-elevated p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-100 to-slate-50 flex items-center justify-center">
                <Info className="w-5 h-5 text-slate-500" />
              </div>
              <div>
                <h4 className="font-semibold text-slate-800">Using Defaults</h4>
                <p className="text-xs text-slate-500">Provide these for better accuracy</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {result.factors_missing.map((factor, index) => (
                <span
                  key={factor}
                  className="px-3 py-1.5 bg-slate-50 text-slate-500 text-sm font-medium rounded-lg border border-slate-200 animate-fade-in-up"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  {factor}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Input Values Summary */}
      <div className="card-elevated p-5">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-100 to-blue-50 flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h4 className="font-semibold text-slate-800">Your Health Metrics</h4>
            <p className="text-xs text-slate-500">Values used for risk calculation</p>
          </div>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            icon={<Activity className="w-4 h-4" />}
            label="Glucose"
            value={result.input_values.glucose}
            unit="mg/dL"
            index={0}
          />
          <MetricCard
            icon={<TrendingUp className="w-4 h-4" />}
            label="BMI"
            value={result.input_values.bmi}
            unit="kg/m²"
            index={1}
          />
          <MetricCard
            icon={<Calendar className="w-4 h-4" />}
            label="Age"
            value={result.input_values.age}
            unit="years"
            index={2}
          />
          <MetricCard
            icon={<Shield className="w-4 h-4" />}
            label="Blood Pressure"
            value={result.input_values.blood_pressure}
            unit="mmHg"
            index={3}
          />
        </div>
      </div>

      {/* Model Information */}
      <div className="card p-5">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-100 to-indigo-50 flex items-center justify-center">
            <Brain className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h4 className="font-semibold text-slate-800">Prediction Model</h4>
            <p className="text-xs text-slate-500">Machine learning powered analysis</p>
          </div>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-3 rounded-xl bg-slate-50/80 border border-slate-100">
            <div className="flex items-center gap-2 text-slate-400 mb-1">
              <Cpu className="w-3.5 h-3.5" />
              <span className="text-label">Model</span>
            </div>
            <p className="font-semibold text-slate-700">{result.model_info.name}</p>
          </div>
          <div className="p-3 rounded-xl bg-slate-50/80 border border-slate-100">
            <div className="flex items-center gap-2 text-slate-400 mb-1">
              <TrendingUp className="w-3.5 h-3.5" />
              <span className="text-label">Accuracy</span>
            </div>
            <p className="font-semibold text-emerald-600">{(result.model_info.accuracy * 100).toFixed(1)}%</p>
          </div>
          <div className="p-3 rounded-xl bg-slate-50/80 border border-slate-100">
            <div className="flex items-center gap-2 text-slate-400 mb-1">
              <Database className="w-3.5 h-3.5" />
              <span className="text-label">Dataset</span>
            </div>
            <p className="font-semibold text-slate-700">{result.model_info.dataset || 'Clinical'}</p>
          </div>
          <div className="p-3 rounded-xl bg-slate-50/80 border border-slate-100">
            <div className="flex items-center gap-2 text-slate-400 mb-1">
              <Calendar className="w-3.5 h-3.5" />
              <span className="text-label">Trained</span>
            </div>
            <p className="font-semibold text-slate-700">
              {new Date(result.model_info.training_date).toLocaleDateString('en-US', {
                month: 'short',
                year: 'numeric',
              })}
            </p>
          </div>
        </div>
      </div>

      {/* SHAP Explanation */}
      {'explanation' in result && result.explanation && !result.explanation.error && (
        <ShapExplanation explanation={result.explanation} />
      )}

      {/* Confidence Interval */}
      {'confidence_interval' in result && result.confidence_interval && !result.confidence_interval.error && (
        <ConfidenceDisplay
          interval={result.confidence_interval}
          riskCategory={result.risk_category}
        />
      )}
    </div>
  );
};

// Metric Card Component
interface MetricCardProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  unit: string;
  index: number;
}

const MetricCard = ({ icon, label, value, unit, index }: MetricCardProps) => (
  <div
    className="p-4 rounded-xl bg-gradient-to-br from-slate-50 to-white border border-slate-100 animate-fade-in-up hover:shadow-md transition-shadow"
    style={{ animationDelay: `${index * 100}ms` }}
  >
    <div className="flex items-center gap-2 text-slate-400 mb-2">
      {icon}
      <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
    </div>
    <p className="text-2xl font-bold text-slate-800">
      {typeof value === 'number' ? value.toFixed(value % 1 === 0 ? 0 : 1) : value}
      <span className="text-sm font-normal text-slate-400 ml-1">{unit}</span>
    </p>
  </div>
);

export default RiskAssessment;
