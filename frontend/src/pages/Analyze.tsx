import { useState, useEffect, useRef } from 'react';
import { Sparkles, AlertCircle, X, Scan, FlaskConical, Shield, RotateCcw } from 'lucide-react';
import FileUpload from '../components/FileUpload';
import ManualInputForm from '../components/ManualInputForm';
import RiskAssessmentForm from '../components/RiskAssessmentForm';
import ResultsDisplay from '../components/ResultsDisplay';
import OcrFieldsEditor from '../components/OcrFieldsEditor';
import Disclaimer from '../components/Disclaimer';
import { analyzeImage, analyzeManualInput, predictRiskWithExplanation, getSupportedTests } from '../services/api';
import type {
  AnalysisMode,
  ResultType,
  ManualInputRequest,
  RiskPredictionInput,
  ExtractedField,
  TestType,
  AnalyzeResponse,
} from '../types';
import { TEST_TYPE_UNITS } from '../types';

const TABS: { id: AnalysisMode; label: string; shortLabel: string; icon: React.ReactNode; description: string; gradient: string }[] = [
  {
    id: 'upload',
    label: 'Upload Report',
    shortLabel: 'Upload',
    icon: <Scan className="w-5 h-5" />,
    description: 'Upload a lab report image and let AI extract glucose values automatically',
    gradient: 'from-blue-500 to-indigo-600',
  },
  {
    id: 'manual',
    label: 'Manual Input',
    shortLabel: 'Manual',
    icon: <FlaskConical className="w-5 h-5" />,
    description: 'Enter your glucose values manually for instant ADA-based classification',
    gradient: 'from-emerald-500 to-teal-600',
  },
  {
    id: 'risk',
    label: 'Risk Assessment',
    shortLabel: 'Risk',
    icon: <Shield className="w-5 h-5" />,
    description: 'Predict your diabetes risk using our machine learning model',
    gradient: 'from-violet-500 to-purple-600',
  },
];

const LOADING_MESSAGES: Record<AnalysisMode, { title: string; subtitle: string }> = {
  upload: { title: 'Analyzing Report', subtitle: 'Extracting glucose values with OCR...' },
  manual: { title: 'Classifying Value', subtitle: 'Applying ADA guidelines...' },
  risk: { title: 'Calculating Risk', subtitle: 'Processing health factors...' },
};

const Analyze = () => {
  const [mode, setMode] = useState<AnalysisMode>('upload');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<ResultType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ocrFields, setOcrFields] = useState<Record<string, ExtractedField> | null>(null);
  const [baseOcrResult, setBaseOcrResult] = useState<AnalyzeResponse | null>(null);
  const lastActionRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    getSupportedTests();
  }, []);

  useEffect(() => {
    setResult(null);
    setError(null);
    setOcrFields(null);
    setBaseOcrResult(null);
  }, [mode]);

  const handleFileAnalysis = async (file: File) => {
    lastActionRef.current = () => handleFileAnalysis(file);
    setIsLoading(true);
    setError(null);
    setResult(null);
    setOcrFields(null);
    setBaseOcrResult(null);

    const response = await analyzeImage(file);

    if (response.success && response.data) {
      setResult({ type: 'analyze', data: response.data });
      setBaseOcrResult(response.data);
      if (response.data.extracted_fields && Object.keys(response.data.extracted_fields).length > 0) {
        setOcrFields(response.data.extracted_fields);
      }
    } else {
      setError(response.error || response.message || 'Failed to analyze image');
    }

    setIsLoading(false);
  };

  const handleOcrReanalyze = async (editedValues: Record<string, { value: number; unit: string }>) => {
    setIsLoading(true);
    setError(null);

    const entries = Object.entries(editedValues);
    const responses = await Promise.all(
      entries.map(([testType, { value, unit }]) =>
        analyzeManualInput({
          test_type: testType as TestType,
          value,
          unit: unit || TEST_TYPE_UNITS[testType as TestType],
        })
      )
    );

    const classifications = responses
      .map((r, i) => {
        if (!r.success || !r.data) return null;
        const [testType, { value, unit }] = entries[i];
        return {
          detected: {
            test_type: testType as TestType,
            value,
            unit,
            confidence: ocrFields?.[testType]?.confidence ?? 1.0,
          },
          classification: r.data.classification,
        };
      })
      .filter((c): c is NonNullable<typeof c> => c !== null);

    if (classifications.length > 0 && baseOcrResult) {
      const severity_levels = classifications.map(c => c.classification.severity);
      let summary = 'Re-analyzed with your corrected values. Values appear within normal range.';
      if (severity_levels.includes('high')) {
        summary = 'Re-analyzed with your corrections. Some values are in the diabetes range. Please consult a healthcare provider.';
      } else if (severity_levels.includes('moderate')) {
        summary = 'Re-analyzed with your corrections. Some values indicate prediabetes or need monitoring.';
      }

      setResult({
        type: 'analyze',
        data: {
          ...baseOcrResult,
          classifications,
          detected_values: classifications.map(c => ({
            test_type: c.detected.test_type as TestType,
            value: c.detected.value,
            unit: c.detected.unit,
            confidence: c.detected.confidence,
          })),
          summary,
        },
      });
    } else {
      setError('Re-analysis failed. Please check the values and try again.');
    }

    setIsLoading(false);
  };

  const handleManualAnalysis = async (input: ManualInputRequest) => {
    lastActionRef.current = () => handleManualAnalysis(input);
    setIsLoading(true);
    setError(null);
    setResult(null);

    const response = await analyzeManualInput(input);

    if (response.success && response.data) {
      setResult({ type: 'manual', data: response.data });
    } else {
      setError(response.error || response.message || 'Failed to classify value');
    }

    setIsLoading(false);
  };

  const handleRiskPrediction = async (input: RiskPredictionInput) => {
    lastActionRef.current = () => handleRiskPrediction(input);
    setIsLoading(true);
    setError(null);
    setResult(null);

    const response = await predictRiskWithExplanation(input);

    if (response.success && response.data) {
      setResult({ type: 'risk', data: response.data });
    } else {
      setError(response.error || response.message || 'Failed to predict risk');
    }

    setIsLoading(false);
  };

  const currentTab = TABS.find((t) => t.id === mode)!;

  return (
    <div className="flex-1 min-h-screen bg-gradient-to-b from-slate-100 via-slate-50 to-white">
      {/* Hero Header */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-0 right-1/4 w-64 h-64 bg-blue-500/20 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 left-1/4 w-48 h-48 bg-indigo-500/20 rounded-full blur-3xl"></div>
        </div>
        <div className="container mx-auto px-4 py-12 relative">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm px-4 py-2 rounded-full mb-4 border border-white/10">
              <Sparkles className="w-4 h-4 text-blue-300" />
              <span className="text-sm font-medium text-blue-100">AI-Powered Analysis</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold mb-3">
              Glucose Analysis
            </h1>
            <p className="text-blue-100/80 text-lg max-w-xl mx-auto">
              Upload a lab report, enter values manually, or assess your diabetes risk
            </p>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 max-w-4xl -mt-8 relative">
        {/* Tab Navigation Card */}
        <div className="card-elevated p-2 mb-8" role="tablist" aria-label="Analysis mode">
          <div className="grid grid-cols-3 gap-2">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                role="tab"
                aria-selected={mode === tab.id}
                aria-controls={`panel-${tab.id}`}
                id={`tab-${tab.id}`}
                onClick={() => setMode(tab.id)}
                className={`relative flex flex-col items-center gap-2 py-4 px-3 rounded-xl font-medium transition-all duration-300 ${
                  mode === tab.id
                    ? `bg-gradient-to-br ${tab.gradient} text-white shadow-lg`
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  mode === tab.id ? 'bg-white/20' : 'bg-slate-100'
                }`}>
                  {tab.icon}
                </div>
                <span className="text-sm hidden sm:inline">{tab.label}</span>
                <span className="text-xs sm:hidden">{tab.shortLabel}</span>
                {mode === tab.id && (
                  <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-inherit rotate-45 rounded-sm"></div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Description */}
        <div className="flex items-center justify-center gap-3 mb-6">
          <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${currentTab.gradient} flex items-center justify-center`}>
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <p className="text-sm text-slate-600">{currentTab.description}</p>
        </div>

        {/* Main Content Card */}
        <div
          className="card-elevated p-4 sm:p-8 mb-8"
          role="tabpanel"
          id={`panel-${mode}`}
          aria-labelledby={`tab-${mode}`}
        >
          {mode === 'upload' && (
            <FileUpload onFileSelect={handleFileAnalysis} isLoading={isLoading} />
          )}
          {mode === 'manual' && (
            <ManualInputForm onSubmit={handleManualAnalysis} isLoading={isLoading} />
          )}
          {mode === 'risk' && (
            <RiskAssessmentForm onSubmit={handleRiskPrediction} isLoading={isLoading} />
          )}
        </div>

        {/* OCR Fields Editor — shown after upload analysis when fields were detected */}
        {mode === 'upload' && ocrFields && Object.keys(ocrFields).length > 0 && !isLoading && (
          <div className="mb-8 animate-fade-in-up">
            <OcrFieldsEditor
              extractedFields={ocrFields}
              onReanalyze={handleOcrReanalyze}
              isLoading={isLoading}
            />
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="card-elevated p-6 sm:p-10 mb-8 animate-fade-in-up" role="status" aria-live="polite">
            <div className="flex flex-col items-center justify-center">
              <div className="relative mb-6">
                <div className={`w-20 h-20 rounded-2xl bg-gradient-to-br ${currentTab.gradient} flex items-center justify-center shadow-lg`}>
                  <div className="absolute inset-0 rounded-2xl bg-white/20 animate-pulse"></div>
                  {currentTab.icon}
                </div>
                <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-white rounded-full border-2 border-slate-100 flex items-center justify-center">
                  <div className="w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                </div>
              </div>
              <h3 className="text-lg font-semibold text-slate-800 mb-1">{LOADING_MESSAGES[mode].title}</h3>
              <p className="text-sm text-slate-500">{LOADING_MESSAGES[mode].subtitle}</p>
              <div className="mt-6 flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0s' }}></div>
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
              </div>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && !isLoading && (
          <div className="card-elevated overflow-hidden mb-8 animate-fade-in-up" role="alert">
            <div className="bg-gradient-to-r from-rose-500 to-red-600 p-4 text-white">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold">Analysis Failed</h3>
                  <p className="text-rose-100 text-sm">Something went wrong</p>
                </div>
              </div>
            </div>
            <div className="p-5 bg-gradient-to-b from-rose-50 to-white">
              <p className="text-slate-700 mb-4">{error}</p>
              <div className="flex items-center gap-2">
                {lastActionRef.current && (
                  <button
                    onClick={() => {
                      lastActionRef.current?.();
                      setError(null);
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-100 text-indigo-700 font-medium rounded-lg hover:bg-indigo-200 transition-colors"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Try again
                  </button>
                )}
                <button
                  onClick={() => setError(null)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-rose-100 text-rose-700 font-medium rounded-lg hover:bg-rose-200 transition-colors"
                >
                  <X className="w-4 h-4" />
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Results */}
        {result && !isLoading && (
          <div className="mb-8 animate-fade-in-up">
            <ResultsDisplay result={result} />
          </div>
        )}

        {/* Disclaimer */}
        <Disclaimer variant="compact" />
      </div>
    </div>
  );
};

export default Analyze;
