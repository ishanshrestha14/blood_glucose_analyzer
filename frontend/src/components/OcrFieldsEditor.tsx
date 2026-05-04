import { useState } from 'react';
import { AlertTriangle, CheckCircle, RefreshCw, Eye } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { ExtractedField, TestType } from '../types';
import { TEST_TYPE_LABELS, TEST_TYPE_UNITS } from '../types';

interface OcrFieldsEditorProps {
  extractedFields: Record<string, ExtractedField>;
  onReanalyze: (editedValues: Record<string, { value: number; unit: string }>) => void;
  isLoading?: boolean;
}

const OcrFieldsEditor = ({ extractedFields, onReanalyze, isLoading }: OcrFieldsEditorProps) => {
  const { t } = useTranslation();
  const [editedValues, setEditedValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    Object.entries(extractedFields).forEach(([type, field]) => {
      init[type] = String(field.value);
    });
    return init;
  });

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const handleChange = (testType: string, raw: string) => {
    setEditedValues(prev => ({ ...prev, [testType]: raw }));
    if (raw && isNaN(parseFloat(raw))) {
      setFieldErrors(prev => ({ ...prev, [testType]: t('ocrEditor.invalidNumber') }));
    } else {
      setFieldErrors(prev => {
        const next = { ...prev };
        delete next[testType];
        return next;
      });
    }
  };

  const handleConfirm = () => {
    const values: Record<string, { value: number; unit: string }> = {};
    let hasError = false;

    Object.entries(editedValues).forEach(([testType, raw]) => {
      const num = parseFloat(raw);
      if (isNaN(num)) {
        setFieldErrors(prev => ({ ...prev, [testType]: t('ocrEditor.invalidNumber') }));
        hasError = true;
      } else {
        values[testType] = {
          value: num,
          unit: extractedFields[testType]?.unit ?? TEST_TYPE_UNITS[testType as TestType] ?? 'mg/dL',
        };
      }
    });

    if (!hasError) onReanalyze(values);
  };

  const entries = Object.entries(extractedFields);
  const hasLowConfidence = entries.some(([, f]) => f.low_confidence);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 bg-gradient-to-r from-slate-50 to-blue-50 border-b border-slate-100 flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
          <Eye className="w-4 h-4 text-white" />
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-800">{t('ocrEditor.header')}</p>
          <p className="text-xs text-slate-500 mt-0.5">
            {t('ocrEditor.subheader')}
          </p>
        </div>
      </div>

      {/* Low confidence banner */}
      {hasLowConfidence && (
        <div className="flex items-start gap-2.5 px-5 py-3 bg-amber-50 border-b border-amber-100">
          <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-amber-700">
            {t('ocrEditor.lowConfidenceBanner')}
          </p>
        </div>
      )}

      {/* Fields */}
      <div className="divide-y divide-slate-100">
        {entries.map(([testType, field]) => {
          const label = TEST_TYPE_LABELS[testType as TestType] ?? testType;
          const isLow = field.low_confidence;
          const confidencePct = Math.round(field.confidence * 100);
          const error = fieldErrors[testType];

          return (
            <div key={testType} className="px-5 py-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-slate-700">{label}</span>
                {isLow ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                    <AlertTriangle className="w-3 h-3" />
                    {confidencePct}% {t('ocrEditor.confidence')}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                    <CheckCircle className="w-3 h-3" />
                    {confidencePct}% {t('ocrEditor.confidence')}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="any"
                  value={editedValues[testType] ?? ''}
                  onChange={e => handleChange(testType, e.target.value)}
                  disabled={isLoading}
                  className={`w-32 px-3 py-2 rounded-xl border text-sm font-mono font-semibold text-slate-800 focus:outline-none focus:ring-2 transition-all ${
                    error
                      ? 'border-rose-300 focus:ring-rose-200'
                      : isLow
                      ? 'border-amber-300 bg-amber-50 focus:ring-amber-200'
                      : 'border-slate-200 focus:ring-blue-200'
                  }`}
                />
                <span className="text-sm text-slate-500 font-medium">{field.unit}</span>
              </div>

              {error && (
                <p className="mt-1.5 text-xs text-rose-600">{error}</p>
              )}
              {isLow && !error && (
                <p className="mt-1.5 text-xs text-amber-600">
                  {t('ocrEditor.lowConfidenceWarning')}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="px-5 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-3">
        <p className="text-xs text-slate-400">
          {t('ocrEditor.footerNote')}
        </p>
        <button
          onClick={handleConfirm}
          disabled={isLoading || Object.keys(fieldErrors).length > 0}
          className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-medium rounded-xl hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm hover:shadow-md active:scale-[0.98]"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          {t('ocrEditor.confirmButton')}
        </button>
      </div>
    </div>
  );
};

export default OcrFieldsEditor;
