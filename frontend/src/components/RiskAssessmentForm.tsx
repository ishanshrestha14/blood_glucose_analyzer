import { useState } from 'react';
import {
  Activity,
  Scale,
  Calendar,
  Heart,
  ChevronDown,
  ChevronUp,
  Info,
  Sparkles,
  Plus,
  Zap,
  Shield,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { RiskPredictionInput } from '../types';

interface RiskAssessmentFormProps {
  onSubmit: (data: RiskPredictionInput) => void;
  isLoading?: boolean;
}

interface FormErrors {
  glucose?: string;
  bmi?: string;
  age?: string;
  blood_pressure?: string;
}

const FIELD_CONFIG = {
  glucose: {
    unit: 'mg/dL',
    placeholder: '100',
    min: 20,
    max: 600,
    icon: Activity,
    gradient: 'from-blue-500 to-indigo-600',
  },
  bmi: {
    unit: 'kg/m²',
    placeholder: '25',
    min: 10,
    max: 70,
    icon: Scale,
    gradient: 'from-emerald-500 to-teal-600',
  },
  age: {
    unit: 'years',
    placeholder: '45',
    min: 1,
    max: 120,
    icon: Calendar,
    gradient: 'from-violet-500 to-purple-600',
  },
  blood_pressure: {
    unit: 'mmHg',
    placeholder: '80',
    min: 20,
    max: 200,
    icon: Heart,
    gradient: 'from-rose-500 to-pink-600',
  },
};

const OPTIONAL_FIELDS = {
  insulin:          { unit: 'μU/mL', placeholder: '80',  min: 0, max: 900 },
  skin_thickness:   { unit: 'mm',    placeholder: '20',  min: 0, max: 100 },
  pregnancies:      { unit: 'count', placeholder: '0',   min: 0, max: 20  },
  diabetes_pedigree:{ unit: 'score', placeholder: '0.5', min: 0, max: 3   },
};

const RiskAssessmentForm = ({ onSubmit, isLoading }: RiskAssessmentFormProps) => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    glucose: '',
    bmi: '',
    age: '',
    blood_pressure: '',
    insulin: '',
    skin_thickness: '',
    pregnancies: '',
    diabetes_pedigree: '',
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [showOptional, setShowOptional] = useState(false);

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};
    const required = ['glucose', 'bmi', 'age', 'blood_pressure'] as const;

    for (const field of required) {
      const value = formData[field];
      const config = FIELD_CONFIG[field];

      if (!value.trim()) {
        newErrors[field] = t('riskForm.errors.required');
      } else {
        const numValue = parseFloat(value);
        if (isNaN(numValue)) {
          newErrors[field] = t('riskForm.errors.required');
        } else if (numValue < config.min) {
          newErrors[field] = t('riskForm.errors.tooLow');
        } else if (numValue > config.max) {
          newErrors[field] = t('riskForm.errors.tooHigh');
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    const input: RiskPredictionInput = {
      glucose: parseFloat(formData.glucose),
      bmi: parseFloat(formData.bmi),
      age: parseFloat(formData.age),
      blood_pressure: parseFloat(formData.blood_pressure),
    };

    if (formData.insulin) input.insulin = parseFloat(formData.insulin);
    if (formData.skin_thickness) input.skin_thickness = parseFloat(formData.skin_thickness);
    if (formData.pregnancies) input.pregnancies = parseFloat(formData.pregnancies);
    if (formData.diabetes_pedigree) input.diabetes_pedigree = parseFloat(formData.diabetes_pedigree);

    onSubmit(input);
  };

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const optionalFieldsCount = [
    formData.insulin,
    formData.skin_thickness,
    formData.pregnancies,
    formData.diabetes_pedigree,
  ].filter((v) => v.trim()).length;

  const requiredFieldsCount = [
    formData.glucose,
    formData.bmi,
    formData.age,
    formData.blood_pressure,
  ].filter((v) => v.trim()).length;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Progress Indicator */}
      <div className="flex items-center justify-between p-4 bg-gradient-to-r from-slate-50 to-blue-50 rounded-xl border border-slate-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-800">Health Assessment</p>
            <p className="text-xs text-slate-500">{requiredFieldsCount}/4 {t('riskForm.requiredFields')}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className={`w-2.5 h-2.5 rounded-full transition-all ${
                i <= requiredFieldsCount
                  ? 'bg-gradient-to-r from-blue-500 to-indigo-600'
                  : 'bg-slate-200'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Required Fields */}
      <div>
        <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
          <Zap className="w-4 h-4 text-blue-500" />
          {t('riskForm.requiredFields')}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(Object.keys(FIELD_CONFIG) as (keyof typeof FIELD_CONFIG)[]).map((field) => {
            const config = FIELD_CONFIG[field];
            const Icon = config.icon;
            const hasValue = formData[field].trim() !== '';
            return (
              <div key={field} className="group">
                <label className="block text-sm font-medium text-slate-600 mb-2">
                  {t(`riskForm.fields.${field}.label`)}
                </label>
                <div className="relative">
                  <div
                    className={`absolute left-0 top-0 bottom-0 w-12 rounded-l-xl flex items-center justify-center transition-colors ${
                      hasValue
                        ? `bg-gradient-to-br ${config.gradient}`
                        : 'bg-slate-100 group-hover:bg-slate-200'
                    }`}
                  >
                    <Icon className={`w-5 h-5 ${hasValue ? 'text-white' : 'text-slate-400'}`} />
                  </div>
                  <input
                    type="number"
                    value={formData[field]}
                    onChange={(e) => handleChange(field, e.target.value)}
                    placeholder={config.placeholder}
                    step="0.1"
                    className={`w-full pl-16 pr-16 py-3.5 bg-white border-2 rounded-xl text-slate-700 font-medium placeholder:text-slate-400 placeholder:font-normal focus:outline-none transition-all ${
                      errors[field]
                        ? 'border-rose-300 bg-rose-50'
                        : hasValue
                        ? 'border-slate-300'
                        : 'border-slate-200 focus:border-blue-500'
                    }`}
                    disabled={isLoading}
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-400 bg-slate-100 px-2 py-1 rounded">
                    {config.unit}
                  </span>
                </div>
                {errors[field] ? (
                  <p className="mt-1.5 text-xs text-rose-500 flex items-center gap-1">
                    <Info className="w-3 h-3" />
                    {errors[field]}
                  </p>
                ) : (
                  <p className="mt-1.5 text-xs text-slate-400">{t(`riskForm.fields.${field}.hint`)}</p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Optional Fields Toggle */}
      <div className="border-t border-slate-100 pt-5">
        <button
          type="button"
          onClick={() => setShowOptional(!showOptional)}
          className={`w-full flex items-center justify-between p-4 rounded-xl border-2 transition-all ${
            showOptional
              ? 'bg-gradient-to-r from-indigo-50 to-purple-50 border-indigo-200'
              : 'bg-slate-50 hover:bg-slate-100 border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${
                showOptional
                  ? 'bg-gradient-to-br from-indigo-500 to-purple-600'
                  : 'bg-slate-200'
              }`}
            >
              <Plus className={`w-5 h-5 ${showOptional ? 'text-white' : 'text-slate-500'}`} />
            </div>
            <div className="text-left">
              <p className="text-sm font-semibold text-slate-700">
                {showOptional ? t('riskForm.hideOptional') : t('riskForm.showOptional')}
                {optionalFieldsCount > 0 && (
                  <span className="ml-2 px-2 py-0.5 bg-indigo-100 text-indigo-700 text-xs font-medium rounded-full">
                    {optionalFieldsCount}
                  </span>
                )}
              </p>
              <p className="text-xs text-slate-500">{t('riskForm.optionalNote')}</p>
            </div>
          </div>
          <div
            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
              showOptional ? 'bg-white' : 'bg-slate-200'
            }`}
          >
            {showOptional ? (
              <ChevronUp className="w-5 h-5 text-indigo-600" />
            ) : (
              <ChevronDown className="w-5 h-5 text-slate-500" />
            )}
          </div>
        </button>

        {showOptional && (
          <div className="mt-4 p-4 bg-gradient-to-b from-slate-50 to-white rounded-xl border border-slate-200 animate-fade-in-up">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(Object.keys(OPTIONAL_FIELDS) as (keyof typeof OPTIONAL_FIELDS)[]).map((field) => {
                const config = OPTIONAL_FIELDS[field];
                return (
                  <div key={field}>
                    <label className="block text-sm font-medium text-slate-600 mb-2">
                      {t(`riskForm.fields.${field}.label`)}
                      <span className="text-slate-400 font-normal ml-1 text-xs">(optional)</span>
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        value={formData[field]}
                        onChange={(e) => handleChange(field, e.target.value)}
                        placeholder={config.placeholder}
                        step="0.1"
                        className="w-full px-4 pr-16 py-3 bg-white border-2 border-slate-200 rounded-xl text-slate-700 placeholder:text-slate-400 focus:outline-none focus:border-indigo-400 transition-colors"
                        disabled={isLoading}
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                        {config.unit}
                      </span>
                    </div>
                    <p className="mt-1.5 text-xs text-slate-400">{t(`riskForm.fields.${field}.hint`)}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={isLoading || requiredFieldsCount < 4}
        className="w-full py-4 px-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold rounded-xl hover:from-indigo-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg shadow-indigo-500/25 hover:shadow-xl hover:shadow-indigo-500/30 active:scale-[0.98]"
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
            {t('riskForm.calculating')}
          </span>
        ) : (
          <span className="flex items-center justify-center gap-2">
            <Sparkles className="w-5 h-5" />
            {t('riskForm.assessRisk')}
          </span>
        )}
      </button>

      {/* Info Note */}
      <div className="flex items-center justify-center gap-2 text-xs text-slate-400">
        <Info className="w-3.5 h-3.5" />
        <span>{t('riskForm.optionalNote')}</span>
      </div>
    </form>
  );
};

export default RiskAssessmentForm;
