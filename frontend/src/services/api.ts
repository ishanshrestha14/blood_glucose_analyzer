import axios from 'axios';
import type { AxiosError } from 'axios';
import type {
  AnalyzeResponse,
  ManualInputRequest,
  ManualInputResponse,
  RiskPredictionInput,
  RiskPredictionResponse,
  RiskPredictionWithExplanation,
  HealthCheckResponse,
  SupportedTestsResponse,
  ThresholdsResponse,
  PredictionRequirementsResponse,
  ApiResponse,
  HistoryResponse,
  SaveAnalysisRequest,
  SaveAnalysisResponse,
  TrendResponse,
  TrendInsight,
} from '../types';

// ============================================
// Configuration
// ============================================
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
});

// ============================================
// Error Handler
// ============================================
interface BackendError {
  error?: string;
  message?: string;
  validation_errors?: string[];
}

function handleApiError<T>(error: unknown): ApiResponse<T> {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<BackendError>;

    if (axiosError.response?.data) {
      const data = axiosError.response.data;
      return {
        success: false,
        error: data.error || data.message || 'Request failed',
        message: data.message,
      };
    }

    if (axiosError.code === 'ECONNABORTED') {
      return {
        success: false,
        error: 'Request timeout',
        message: 'The analysis is taking longer than expected. Please try again with a clearer image.',
      };
    }

    if (axiosError.code === 'ERR_NETWORK') {
      return {
        success: false,
        error: 'Connection failed',
        message: 'Unable to connect to the analysis server. Please ensure the backend service is running.',
      };
    }

    return {
      success: false,
      error: axiosError.message || 'An unexpected error occurred',
    };
  }

  return {
    success: false,
    error: 'An unexpected error occurred',
  };
}

// ============================================
// Health Check
// ============================================
export async function getHealthCheck(): Promise<ApiResponse<HealthCheckResponse>> {
  try {
    const response = await apiClient.get<HealthCheckResponse>('/api/health');
    return { success: true, data: response.data };
  } catch (error) {
    return handleApiError<HealthCheckResponse>(error);
  }
}

// ============================================
// Image Analysis (OCR + Classification)
// ============================================
export async function analyzeImage(file: File): Promise<ApiResponse<AnalyzeResponse>> {
  try {
    const formData = new FormData();
    formData.append('file', file);

    const response = await apiClient.post<AnalyzeResponse>('/api/analyze', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      timeout: 60000, // 60 seconds for OCR processing
    });

    return { success: true, data: response.data };
  } catch (error) {
    return handleApiError<AnalyzeResponse>(error);
  }
}

// ============================================
// Manual Input Classification
// ============================================
export async function analyzeManualInput(
  input: ManualInputRequest
): Promise<ApiResponse<ManualInputResponse>> {
  try {
    const response = await apiClient.post<ManualInputResponse>('/api/manual-input', input, {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    return { success: true, data: response.data };
  } catch (error) {
    return handleApiError<ManualInputResponse>(error);
  }
}

// ============================================
// Risk Prediction
// ============================================
export async function predictRisk(
  input: RiskPredictionInput
): Promise<ApiResponse<RiskPredictionResponse>> {
  try {
    const response = await apiClient.post<RiskPredictionResponse>('/api/predict-risk', input, {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    return { success: true, data: response.data };
  } catch (error) {
    return handleApiError<RiskPredictionResponse>(error);
  }
}

export async function predictRiskWithExplanation(
  input: RiskPredictionInput
): Promise<ApiResponse<RiskPredictionWithExplanation>> {
  try {
    const response = await apiClient.post<RiskPredictionWithExplanation>(
      '/api/predict-risk/explain',
      input,
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    return { success: true, data: response.data };
  } catch (error) {
    return handleApiError<RiskPredictionWithExplanation>(error);
  }
}

export async function getPredictionRequirements(): Promise<
  ApiResponse<PredictionRequirementsResponse>
> {
  try {
    const response = await apiClient.get<PredictionRequirementsResponse>(
      '/api/predict-risk/requirements'
    );
    return { success: true, data: response.data };
  } catch (error) {
    return handleApiError<PredictionRequirementsResponse>(error);
  }
}

// ============================================
// Reference Data
// ============================================
export async function getSupportedTests(): Promise<ApiResponse<SupportedTestsResponse>> {
  try {
    const response = await apiClient.get<SupportedTestsResponse>('/api/supported-tests');
    return { success: true, data: response.data };
  } catch (error) {
    return handleApiError<SupportedTestsResponse>(error);
  }
}

export async function getThresholds(): Promise<ApiResponse<ThresholdsResponse>> {
  try {
    const response = await apiClient.get<ThresholdsResponse>('/api/thresholds');
    return { success: true, data: response.data };
  } catch (error) {
    return handleApiError<ThresholdsResponse>(error);
  }
}

// ============================================
// History & Persistence
// ============================================
export async function saveAnalysis(
  data: SaveAnalysisRequest
): Promise<ApiResponse<SaveAnalysisResponse>> {
  try {
    const response = await apiClient.post<SaveAnalysisResponse>('/api/save-analysis', data, {
      headers: { 'Content-Type': 'application/json' },
    });
    return { success: true, data: response.data };
  } catch (error) {
    return handleApiError<SaveAnalysisResponse>(error);
  }
}

export async function getHistory(params?: {
  limit?: number;
  offset?: number;
  type?: string;
}): Promise<ApiResponse<HistoryResponse>> {
  try {
    const response = await apiClient.get<HistoryResponse>('/api/history', { params });
    return { success: true, data: response.data };
  } catch (error) {
    return handleApiError<HistoryResponse>(error);
  }
}

export async function deleteAnalysis(id: string): Promise<ApiResponse<{ success: boolean }>> {
  try {
    const response = await apiClient.delete<{ success: boolean }>(`/api/history/${id}`);
    return { success: true, data: response.data };
  } catch (error) {
    return handleApiError<{ success: boolean }>(error);
  }
}

export async function getTrends(params: {
  start_date: string;
  end_date: string;
  test_type?: string;
}): Promise<ApiResponse<TrendResponse>> {
  try {
    const response = await apiClient.get<TrendResponse>('/api/trends', { params });
    return { success: true, data: response.data };
  } catch (error) {
    return handleApiError<TrendResponse>(error);
  }
}

export async function getInsight(params: {
  start_date: string;
  end_date: string;
  test_type?: string;
}): Promise<{ success: boolean; insight: TrendInsight | null }> {
  try {
    const response = await apiClient.get<{ success: boolean; insight: TrendInsight | null }>(
      '/api/trends/insight',
      { params }
    );
    return response.data;
  } catch (error) {
    return { success: false, insight: null };
  }
}

// ============================================
// Export client for custom requests
// ============================================
export { apiClient, API_BASE_URL };
