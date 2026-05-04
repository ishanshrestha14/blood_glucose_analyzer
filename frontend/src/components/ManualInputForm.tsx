import { useState } from 'react';
import { FlaskConical, ChevronDown, Info, Sparkles, CheckCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { ManualInputRequest, TestType } from '../types';
import { TEST_TYPE_LABELS } from '../types';

interface ManualInputFormProps {
  onSubmit: (data: ManualInputRequest) => void;
  isLoading?: boolean;
}

const TEST_ICONS: Record<TestType, string> = {
  fasting: 'FBS',
  hba1c: 'A1C',
  ppbs: 'PP',
  rbs: 'RBS',
  ogtt: 'GTT',
};

const TEST_PLACEHOLDERS: Record<TestType, string> = {
  fasting: 'e.g., 95',
  hba1c: 'e.g., 5.7',
  ppbs: 'e.g., 140',
  rbs: 'e.g., 120',
  ogtt: 'e.g., 155',
};

const NORMAL_RANGES: Record<TestType, { range: string; min: number; max: number | null }> = {
  fasting: { range: '70-99 mg/dL', min: 70, max: 99 },
  hba1c: { range: '4.0-5.6%', min: 4.0, max: 5.6 },
  ppbs: { range: '< 140 mg/dL', min: 0, max: 140 },
  rbs: { range: '< 140 mg/dL', min: 0, max: 140 },
  ogtt: { range: '< 140 mg/dL', min: 0, max: 140 },
};

const ManualInputForm = ({ onSubmit, isLoading }: ManualInputFormProps) => {
  const { t } = useTranslation();
  const [testType, setTestType] = useState<TestType>('fasting');
  const [value, setValue] = useState('');
  const [unit, setUnit] = useState<'mg/dL' | 'mmol/L'>('mg/dL');
  const [errors, setErrors] = useState<{ value?: string }>({});

  const isHba1c = testType === 'hba1c';
  const currentUnit = isHba1c ? '%' : unit;

  const validateForm = (): boolean => {
    const newErrors: { value?: string } = {};

    if (!value.trim()) {
      newErrors.value = t('manualInput.errors.required');
    } else {
      const numValue = parseFloat(value);
      if (isNaN(numValue)) {
        newErrors.value = t('manualInput.errors.invalid');
      } else if (numValue <= 0) {
        newErrors.value = t('manualInput.errors.nonPositive');
      } else if (isHba1c && numValue > 20) {
        newErrors.value = t('manualInput.errors.hba1cTooHigh');
      } else if (!isHba1c && numValue > 1000) {
        newErrors.value = t('manualInput.errors.glucoseTooHigh');
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    onSubmit({
      test_type: testType,
      value: parseFloat(value),
      unit: currentUnit,
    });
  };

  const handleTestTypeChange = (newType: TestType) => {
    setTestType(newType);
    setValue('');
    setErrors({});
    if (newType !== 'hba1c') {
      setUnit('mg/dL');
    }
  };

  const numValue = parseFloat(value);
  const normalRange = NORMAL_RANGES[testType];
  const isInNormalRange =
    !isNaN(numValue) &&
    numValue >= normalRange.min &&
    (normalRange.max === null || numValue <= normalRange.max);

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Test Type Selection */}
      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-3">
          {t('manualInput.selectTestType')}
        </label>
        <div className="grid grid-cols-5 gap-2 mb-3">
          {(Object.keys(TEST_TYPE_LABELS) as TestType[]).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => handleTestTypeChange(type)}
              disabled={isLoading}
              className={`relative p-3 rounded-xl border-2 transition-all duration-200 ${
                testType === type
                  ? 'border-blue-500 bg-gradient-to-br from-blue-50 to-indigo-50 shadow-sm'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              <span
                className={`block text-sm font-bold ${
                  testType === type ? 'text-blue-600' : 'text-slate-500'
                }`}
              >
                {TEST_ICONS[type]}
              </span>
              {testType === type && (
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                  <CheckCircle className="w-3 h-3 text-white" />
                </div>
              )}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 p-3 bg-gradient-to-r from-slate-50 to-slate-100 rounded-xl border border-slate-200">
          <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
            <Info className="w-4 h-4 text-blue-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-700">{TEST_TYPE_LABELS[testType]}</p>
            <p className="text-xs text-slate-500">{t(`manualInput.hints.${testType}`)}</p>
          </div>
        </div>
      </div>

      {/* Value Input */}
      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-3">
          {t('manualInput.enterValue')}
        </label>
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <div className="absolute left-4 top-1/2 -translate-y-1/2">
              <FlaskConical className="w-5 h-5 text-slate-400" />
            </div>
            <input
              type="number"
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                if (errors.value) setErrors({});
              }}
              step="0.1"
              min="0"
              placeholder={TEST_PLACEHOLDERS[testType]}
              className={`w-full pl-12 pr-4 py-4 bg-white border-2 rounded-xl text-lg font-medium text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-0 transition-all duration-200 ${
                errors.value
                  ? 'border-rose-300 bg-rose-50'
                  : value && isInNormalRange
                  ? 'border-emerald-300 bg-emerald-50/50'
                  : value && !isInNormalRange
                  ? 'border-amber-300 bg-amber-50/50'
                  : 'border-slate-200 focus:border-blue-500'
              }`}
              disabled={isLoading}
            />
            {value && !errors.value && (
              <div
                className={`absolute right-4 top-1/2 -translate-y-1/2 px-2 py-0.5 rounded text-xs font-medium ${
                  isInNormalRange
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-amber-100 text-amber-700'
                }`}
              >
                {isInNormalRange ? t('manualInput.normal') : t('manualInput.elevated')}
              </div>
            )}
          </div>

          {/* Unit Selector (hidden for HbA1c) */}
          {!isHba1c ? (
            <div className="relative">
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value as 'mg/dL' | 'mmol/L')}
                className="appearance-none h-full px-5 pr-10 bg-slate-100 border-2 border-slate-200 rounded-xl text-slate-600 font-medium focus:outline-none focus:ring-0 focus:border-blue-500 cursor-pointer transition-colors"
                disabled={isLoading}
              >
                <option value="mg/dL">mg/dL</option>
                <option value="mmol/L">mmol/L</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>
          ) : (
            <div className="flex items-center px-6 bg-slate-100 border-2 border-slate-200 rounded-xl">
              <span className="text-slate-600 text-lg font-semibold">%</span>
            </div>
          )}
        </div>

        {errors.value && (
          <p className="mt-2 text-sm text-rose-600 flex items-center gap-1">
            <Info className="w-4 h-4" />
            {errors.value}
          </p>
        )}

        {/* Normal Range Reference */}
        <div className="mt-4 p-4 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-600" />
              <span className="text-sm font-medium text-emerald-800">{t('manualInput.normalRange')}</span>
            </div>
            <span className="text-sm font-bold text-emerald-700">{NORMAL_RANGES[testType].range}</span>
          </div>
        </div>
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={isLoading || !value.trim()}
        className="w-full py-4 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30 active:scale-[0.98]"
      >
        {isLoading ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
                fill="none"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            {t('manualInput.analyzing')}
          </span>
        ) : (
          <span className="flex items-center justify-center gap-2">
            <Sparkles className="w-5 h-5" />
            {t('manualInput.analyzeValue')}
          </span>
        )}
      </button>
    </form>
  );
};

export default ManualInputForm;
