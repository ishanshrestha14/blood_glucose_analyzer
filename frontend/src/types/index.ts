// ============================================
// API Configuration
// ============================================
export const API_BASE_URL = 'http://localhost:5000';

// ============================================
// Test Types
// ============================================
export type TestType = 'fasting' | 'hba1c' | 'ppbs' | 'rbs' | 'ogtt';

export const TEST_TYPE_LABELS: Record<TestType, string> = {
  fasting: 'Fasting Blood Sugar (FBS)',
  hba1c: 'HbA1c (Glycated Hemoglobin)',
  ppbs: 'Post-Prandial Blood Sugar (PPBS)',
  rbs: 'Random Blood Sugar (RBS)',
  ogtt: 'Oral Glucose Tolerance Test (OGTT)',
};

export const TEST_TYPE_UNITS: Record<TestType, string> = {
  fasting: 'mg/dL',
  hba1c: '%',
  ppbs: 'mg/dL',
  rbs: 'mg/dL',
  ogtt: 'mg/dL',
};

// ============================================
// Classification Types
// ============================================
export type ClassificationType = 'Low' | 'Normal' | 'Prediabetes' | 'Needs Monitoring' | 'Diabetes';
export type SeverityLevel = 'low' | 'moderate' | 'high';
export type RiskCategory = 'Low' | 'Moderate' | 'High';
export type ConfidenceLevel = 'low' | 'moderate' | 'high';

export interface ClassificationResult {
  success: boolean;
  test_type: TestType;
  display_name: string;
  original_value?: number;
  original_unit?: string;
  value: number;
  unit: string;
  classification: ClassificationType;
  severity: SeverityLevel;
  range: {
    min: number;
    max: number | null;
  };
  normal_range: {
    min: number;
    max: number;
  };
  recommendation: string;
  disclaimer: string;
}

// ============================================
// Manual Input Types
// ============================================
export interface ManualInputRequest {
  test_type: TestType;
  value: number;
  unit?: string;
}

export interface ManualInputResponse {
  success: boolean;
  input: {
    test_type: TestType;
    value: number;
    unit: string;
  };
  classification: ClassificationResult;
}

// ============================================
// OCR Analysis Types
// ============================================
export interface DetectedValue {
  test_type: TestType;
  value: number;
  unit: string;
  confidence: number;
  row_text?: string;
}

export interface ExtractedField {
  value: number;
  unit: string;
  confidence: number;
  low_confidence: boolean;
}

export interface QualityCheck {
  is_sufficient: boolean;
  word_count: number;
  has_numbers: boolean;
  quality?: 'low' | 'moderate' | 'good';
  message: string;
}

export interface ReportValidation {
  is_valid: boolean;
  confidence: number;
  keywords_found: string[];
  report_type_detected?: string;
  message: string;
}

export interface ReportType {
  test_type: string;
  display_name: string;
  is_multiple?: boolean;
  all_types?: string[];
}

export interface ValidationResult {
  is_valid: boolean;
  validation_stage: string;
  quality: QualityCheck;
  report_validation: ReportValidation | null;
  report_type: ReportType | null;
  message: string;
}

export interface ClassificationWithDetection {
  detected: DetectedValue;
  classification: ClassificationResult;
}

export interface AnalyzeResponse {
  success: boolean;
  is_valid_report: boolean;
  validation: ValidationResult;
  extracted_text: string;
  detected_values: DetectedValue[];
  extracted_fields: Record<string, ExtractedField>;
  classifications: ClassificationWithDetection[];
  summary: string;
  analysis_timestamp?: string;
  error?: string;
  message?: string;
}

// ============================================
// Risk Prediction Types
// ============================================
export interface RiskPredictionInput {
  glucose: number;
  bmi: number;
  age: number;
  blood_pressure: number;
  insulin?: number;
  skin_thickness?: number;
  pregnancies?: number;
  diabetes_pedigree?: number;
}

export interface ModelInfo {
  name: string;
  accuracy: number;
  training_date: string;
  features?: string[];
  dataset?: string;
}

export interface RiskPredictionResponse {
  success: boolean;
  risk_probability: number;
  risk_percentage: number;
  risk_category: RiskCategory;
  risk_description: string;
  confidence_level: ConfidenceLevel;
  factors_provided: string[];
  factors_missing: string[];
  input_values: RiskPredictionInput;
  model_info: ModelInfo;
  disclaimer: string;
  error?: string;
  validation_errors?: string[];
  message?: string;
}

// ============================================
// SHAP Explanation Types
// ============================================
export interface FeatureContribution {
  feature: string;
  display_name: string;
  shap_value: number;
  contribution_pct: number;
  direction: 'risk' | 'protective';
  raw_value: number;
  unit: string;
  explanation: string;
}

export interface ShapExplanation {
  base_value: number;
  feature_contributions: FeatureContribution[];
  top_risk_factors: FeatureContribution[];
  top_protective_factors: FeatureContribution[];
  plain_english_summary: string;
  error?: string;
}

export interface ConfidenceInterval {
  mean: number;
  std: number;
  ci_lower: number;
  ci_upper: number;
  ci_lower_pct: number;
  ci_upper_pct: number;
  confidence_level: number;
  tree_count: number;
  error?: string;
}

export interface RiskPredictionWithExplanation extends RiskPredictionResponse {
  explanation: ShapExplanation;
  confidence_interval: ConfidenceInterval;
}

export interface InputRequirement {
  name: string;
  unit: string;
  description: string;
  range: {
    min: number;
    max: number;
  };
  default?: number;
}

export interface PredictionRequirementsResponse {
  success: boolean;
  required: Record<string, InputRequirement>;
  optional: Record<string, InputRequirement>;
}

// ============================================
// Health Check Types
// ============================================
export interface ServiceStatus {
  initialized: boolean;
  error?: string | null;
}

export interface MlModelStatus extends ServiceStatus {
  model_info?: ModelInfo | null;
}

export interface UploadsStatus {
  exists: boolean;
  writable: boolean;
}

export interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'error';
  timestamp: string;
  services: {
    ocr: ServiceStatus;
    ml_model: MlModelStatus;
    uploads: UploadsStatus;
  };
}

// ============================================
// Reference Data Types
// ============================================
export interface SupportedTest {
  display_name: string;
  keywords: string[];
}

export interface SupportedTestsResponse {
  success: boolean;
  supported_types: Record<TestType, SupportedTest>;
  description: string;
}

export interface ThresholdRange {
  classification: string;
  severity: SeverityLevel;
  min: number;
  max: number | null;
  range_display: string;
}

export interface TestThreshold {
  display_name: string;
  unit: string;
  normal_range: {
    min: number;
    max: number;
  };
  ranges: ThresholdRange[];
}

export interface ThresholdsResponse {
  success: boolean;
  thresholds: Record<TestType, TestThreshold>;
  disclaimer: string;
}

// ============================================
// API Response Wrapper
// ============================================
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// ============================================
// UI State Types
// ============================================
export type AnalysisMode = 'upload' | 'manual' | 'risk';

export type ResultType =
  | { type: 'analyze'; data: AnalyzeResponse }
  | { type: 'manual'; data: ManualInputResponse }
  | { type: 'risk'; data: RiskPredictionResponse | RiskPredictionWithExplanation };

// ============================================
// Design System - Colors & Styling
// ============================================
export interface SeverityStyle {
  bg: string;
  border: string;
  text: string;
  badge: string;
  icon: string;
  gradient: string;
}

export const SEVERITY_STYLES: Record<SeverityLevel, SeverityStyle> = {
  low: {
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    text: 'text-emerald-700',
    badge: 'bg-emerald-100 text-emerald-800',
    icon: 'text-emerald-500',
    gradient: 'from-emerald-400 to-emerald-600',
  },
  moderate: {
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    text: 'text-amber-700',
    badge: 'bg-amber-100 text-amber-800',
    icon: 'text-amber-500',
    gradient: 'from-amber-400 to-amber-600',
  },
  high: {
    bg: 'bg-rose-50',
    border: 'border-rose-200',
    text: 'text-rose-700',
    badge: 'bg-rose-100 text-rose-800',
    icon: 'text-rose-500',
    gradient: 'from-rose-400 to-rose-600',
  },
};

export const CLASSIFICATION_STYLES: Record<ClassificationType, SeverityStyle> = {
  Low: SEVERITY_STYLES.moderate,
  Normal: SEVERITY_STYLES.low,
  Prediabetes: SEVERITY_STYLES.moderate,
  'Needs Monitoring': SEVERITY_STYLES.moderate,
  Diabetes: SEVERITY_STYLES.high,
};

export const RISK_STYLES: Record<RiskCategory, SeverityStyle> = {
  Low: SEVERITY_STYLES.low,
  Moderate: SEVERITY_STYLES.moderate,
  High: SEVERITY_STYLES.high,
};

export const CONFIDENCE_LABELS: Record<ConfidenceLevel, string> = {
  low: 'Limited Data',
  moderate: 'Moderate Confidence',
  high: 'High Confidence',
};

// ============================================
// History & Trends Types
// ============================================
export interface AnalysisHistoryItem {
  id: string;
  analysis_type: 'ocr' | 'manual' | 'risk';
  created_at: string;
  test_type?: string;
  glucose_value?: number;
  classification?: string;
  risk_category?: string;
  risk_percentage?: number;
  label?: string;
}

export interface HistoryResponse {
  success: boolean;
  analyses: AnalysisHistoryItem[];
  total: number;
  limit: number;
  offset: number;
}

export interface TrendDataPoint {
  date: string;
  value: number;
  test_type: string;
  classification: string;
}

export interface TrendResponse {
  success: boolean;
  data_points: TrendDataPoint[];
  count: number;
}

export interface SaveAnalysisRequest {
  analysis_type: 'ocr' | 'manual' | 'risk';
  input_data: unknown;
  result_data: unknown;
  test_type?: string;
  glucose_value?: number;
  classification?: string;
  risk_category?: string;
  risk_percentage?: number;
  label?: string;
}

export interface SaveAnalysisResponse {
  success: boolean;
  id: string;
  created_at: string;
}
