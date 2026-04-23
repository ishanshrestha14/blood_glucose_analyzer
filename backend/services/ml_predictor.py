"""
ML Predictor Service - Diabetes Risk Prediction

Uses a trained machine learning model to predict diabetes risk
based on health indicators. The model was trained on the Pima Indians
Diabetes Dataset.
"""

import os
import joblib
from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime


# Path to model files - use absolute paths to avoid issues
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.dirname(CURRENT_DIR)  # Go up one level to backend/
MODELS_DIR = os.path.join(BACKEND_DIR, 'models')

PIPELINE_PATH = os.path.join(MODELS_DIR, 'diabetes_pipeline.pkl')
METADATA_PATH = os.path.join(MODELS_DIR, 'model_metadata.pkl')


# Feature order expected by the model (must match training order)
FEATURE_ORDER = [
    'Pregnancies',
    'Glucose',
    'BloodPressure',
    'SkinThickness',
    'Insulin',
    'BMI',
    'DiabetesPedigreeFunction',
    'Age'
]

# Default values for optional inputs (based on dataset medians)
DEFAULT_VALUES = {
    'pregnancies':      0.0,     # 0 pregnancies is biologically valid
    'diabetes_pedigree': 0.3725, # median from PIMA dataset
}

# Validation ranges for inputs
VALIDATION_RANGES = {
    'glucose': {'min': 20, 'max': 600, 'name': 'Glucose'},
    'bmi': {'min': 10, 'max': 70, 'name': 'BMI'},
    'age': {'min': 1, 'max': 120, 'name': 'Age'},
    'blood_pressure': {'min': 20, 'max': 200, 'name': 'Blood Pressure'},
    'insulin': {'min': 0, 'max': 900, 'name': 'Insulin'},
    'skin_thickness': {'min': 0, 'max': 100, 'name': 'Skin Thickness'},
    'pregnancies': {'min': 0, 'max': 20, 'name': 'Pregnancies'},
    'diabetes_pedigree': {'min': 0, 'max': 3, 'name': 'Diabetes Pedigree Function'}
}

# Risk category thresholds
RISK_THRESHOLDS = {
    'low': 0.30,      # Below 30%
    'moderate': 0.60  # 30-60%, above 60% is high
}

# Standard disclaimer
DISCLAIMER = (
    "This prediction is for educational purposes only. It estimates diabetes risk "
    "based on provided health indicators and should not be considered a medical "
    "diagnosis. The model was trained on a specific dataset and may not account for "
    "all factors affecting diabetes risk. Please consult a healthcare professional "
    "for proper evaluation and diagnosis."
)


class MLPredictor:
    """Diabetes risk prediction using a calibrated sklearn pipeline."""

    def __init__(self):
        self.pipeline  = None
        self.scaler    = None   # kept as None — pipeline handles all preprocessing internally
        self.metadata  = None
        self.initialized = False
        self.init_error  = None
        self._load_models()

    def _load_models(self):
        if not os.path.exists(PIPELINE_PATH):
            self.init_error = f"Pipeline file not found: {PIPELINE_PATH}"
            return
        try:
            # The pipeline was pickled when FeatureEngineer was defined in __main__
            # (the training script). Patch __main__ so joblib can find the class.
            import sys
            from services.feature_engineer import FeatureEngineer
            main_mod = sys.modules.get('__main__')
            if main_mod is not None and not hasattr(main_mod, 'FeatureEngineer'):
                main_mod.FeatureEngineer = FeatureEngineer

            self.pipeline = joblib.load(PIPELINE_PATH)
            if os.path.exists(METADATA_PATH):
                self.metadata = joblib.load(METADATA_PATH)
            else:
                self.metadata = {
                    'model_name': 'CalibratedRandomForest',
                    'pipeline_version': 2,
                }
            self.initialized = True
        except Exception as e:
            self.init_error = f"Error loading pipeline: {str(e)}"

    def _get_model_info(self) -> Dict[str, Any]:
        if not self.metadata:
            return {'name': 'Unknown', 'accuracy': None, 'training_date': None}
        return {
            'name':                self.metadata.get('model_name', 'CalibratedRandomForest'),
            'pipeline_version':    self.metadata.get('pipeline_version', 2),
            'accuracy':            self.metadata.get('accuracy'),
            'roc_auc':             self.metadata.get('roc_auc'),
            'recall':              self.metadata.get('recall'),
            'calibration_method':  self.metadata.get('calibration_method', 'sigmoid'),
            'training_date':       self.metadata.get('training_date', 'Unknown'),
            'features':            self.metadata.get('feature_names', FEATURE_ORDER),
            'engineered_features': self.metadata.get('engineered_features', []),
            'dataset':             self.metadata.get('dataset', 'Pima Indians Diabetes Dataset'),
        }


def validate_inputs(input_data: Dict[str, Any]) -> Tuple[bool, List[str], Dict[str, Any]]:
    """
    Validate input data for prediction.

    Args:
        input_data: Dictionary of input features

    Returns:
        Tuple of (is_valid, error_messages, cleaned_data)
    """
    errors = []
    cleaned = {}

    # Required fields
    required_fields = ['glucose', 'bmi', 'age', 'blood_pressure']

    for field in required_fields:
        if field not in input_data or input_data[field] is None:
            errors.append(f"{VALIDATION_RANGES[field]['name']} is required")
            continue

        try:
            value = float(input_data[field])
            cleaned[field] = value
        except (ValueError, TypeError):
            errors.append(f"{VALIDATION_RANGES[field]['name']} must be a number")

    # Optional fields — only include in cleaned if explicitly provided.
    # Fields absent here will fall back to np.nan inside predict_diabetes_risk()
    # so the pipeline's imputer handles them correctly.
    # pregnancies and diabetes_pedigree have well-defined defaults and are always
    # populated; insulin and skin_thickness are left absent when not supplied.
    optional_fields = ['insulin', 'skin_thickness', 'pregnancies', 'diabetes_pedigree']

    for field in optional_fields:
        if field in input_data and input_data[field] is not None:
            try:
                value = float(input_data[field])
                cleaned[field] = value
            except (ValueError, TypeError):
                # Leave absent so the pipeline imputer handles it
                pass

    # Validate ranges for all provided values
    for field, value in cleaned.items():
        if field in VALIDATION_RANGES:
            range_info = VALIDATION_RANGES[field]
            if value < range_info['min']:
                errors.append(
                    f"{range_info['name']} value ({value}) is below minimum ({range_info['min']})"
                )
            elif value > range_info['max']:
                errors.append(
                    f"{range_info['name']} value ({value}) exceeds maximum ({range_info['max']})"
                )

    is_valid = len(errors) == 0
    return is_valid, errors, cleaned


def get_risk_category(probability: float) -> str:
    """
    Determine risk category based on probability.

    Args:
        probability: Risk probability (0.0 to 1.0)

    Returns:
        Risk category string
    """
    if probability < RISK_THRESHOLDS['low']:
        return 'Low'
    elif probability < RISK_THRESHOLDS['moderate']:
        return 'Moderate'
    else:
        return 'High'


def get_risk_description(category: str) -> str:
    """
    Get a description for the risk category.

    Args:
        category: Risk category (Low, Moderate, High)

    Returns:
        Description string
    """
    descriptions = {
        'Low': (
            "Based on the provided health indicators, your estimated diabetes risk "
            "is in the lower range. Continue maintaining a healthy lifestyle with "
            "balanced nutrition and regular physical activity. Regular health "
            "check-ups are still recommended."
        ),
        'Moderate': (
            "Based on the provided health indicators, your estimated diabetes risk "
            "is moderate. This suggests some risk factors may be present. Consider "
            "discussing lifestyle modifications with your healthcare provider, "
            "including diet, exercise, and regular glucose monitoring."
        ),
        'High': (
            "Based on the provided health indicators, your estimated diabetes risk "
            "is elevated. This does not mean you have diabetes, but suggests that "
            "some risk factors are present. We strongly recommend consulting with "
            "a healthcare professional for a comprehensive evaluation and to discuss "
            "preventive measures."
        )
    }
    return descriptions.get(category, "Please consult a healthcare professional.")


def get_confidence_level(factors_provided: List[str], factors_missing: List[str]) -> str:
    """
    Determine prediction confidence based on available inputs.

    Args:
        factors_provided: List of factors that were provided
        factors_missing: List of factors that used defaults

    Returns:
        Confidence level string
    """
    total = len(factors_provided) + len(factors_missing)
    provided_count = len(factors_provided)

    if provided_count >= 6:
        return 'high'
    elif provided_count >= 4:
        return 'moderate'
    else:
        return 'low'


# Module-level predictor instance (loaded once)
_predictor_instance = None


def get_predictor() -> MLPredictor:
    """Get or create the ML predictor singleton."""
    global _predictor_instance
    if _predictor_instance is None:
        _predictor_instance = MLPredictor()
    return _predictor_instance


def predict_diabetes_risk(input_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Predict diabetes risk based on health indicators.

    Args:
        input_data: Dictionary containing:
            - glucose: float (mg/dL) - REQUIRED
            - bmi: float - REQUIRED
            - age: int - REQUIRED
            - blood_pressure: float (diastolic) - REQUIRED
            - insulin: float (optional)
            - skin_thickness: float (optional)
            - pregnancies: int (optional)
            - diabetes_pedigree: float (optional)

    Returns:
        Dictionary containing prediction results
    """
    predictor = get_predictor()

    if not predictor.initialized:
        return {
            'success': False,
            'error':   predictor.init_error or "Model not initialized",
            'message': "The prediction model could not be loaded. Please ensure model files are properly installed.",
        }

    is_valid, errors, cleaned_data = validate_inputs(input_data)
    if not is_valid:
        return {
            'success': False,
            'error': 'Validation failed',
            'validation_errors': errors,
            'message': "Please correct the following issues: " + "; ".join(errors),
        }

    required_factors = ['glucose', 'bmi', 'age', 'blood_pressure']
    optional_factors = ['insulin', 'skin_thickness', 'pregnancies', 'diabetes_pedigree']
    factors_provided = required_factors.copy()
    factors_missing  = []
    for factor in optional_factors:
        if factor in input_data and input_data[factor] is not None:
            factors_provided.append(factor)
        else:
            factors_missing.append(factor)

    try:
        import numpy as np

        # Build raw 8-feature row in FEATURE_ORDER.
        # Missing optional fields → NaN; the pipeline's imputer fills them.
        features = np.array([[
            cleaned_data.get('pregnancies', DEFAULT_VALUES['pregnancies']),
            cleaned_data['glucose'],
            cleaned_data['blood_pressure'],
            cleaned_data.get('skin_thickness', np.nan),
            cleaned_data.get('insulin', np.nan),
            cleaned_data['bmi'],
            cleaned_data.get('diabetes_pedigree', DEFAULT_VALUES['diabetes_pedigree']),
            cleaned_data['age'],
        ]])

        probabilities    = predictor.pipeline.predict_proba(features)
        risk_probability = float(probabilities[0][1])

        risk_category    = get_risk_category(risk_probability)
        risk_description = get_risk_description(risk_category)
        confidence_level = get_confidence_level(factors_provided, factors_missing)
        model_info       = predictor._get_model_info()

        return {
            'success':          True,
            'risk_probability': round(risk_probability, 4),
            'risk_percentage':  round(risk_probability * 100, 1),
            'risk_category':    risk_category,
            'risk_description': risk_description,
            'confidence_level': confidence_level,
            'factors_provided': factors_provided,
            'factors_missing':  factors_missing,
            'input_values': {
                'glucose':           cleaned_data['glucose'],
                'bmi':               round(cleaned_data['bmi'], 1),
                'age':               int(cleaned_data['age']),
                'blood_pressure':    cleaned_data['blood_pressure'],
                'insulin':           cleaned_data.get('insulin'),
                'skin_thickness':    cleaned_data.get('skin_thickness'),
                'pregnancies':       int(cleaned_data.get('pregnancies', DEFAULT_VALUES['pregnancies'])),
                'diabetes_pedigree': round(
                    cleaned_data.get('diabetes_pedigree', DEFAULT_VALUES['diabetes_pedigree']), 4
                ),
            },
            'model_info': model_info,
            'disclaimer': DISCLAIMER,
        }

    except Exception as e:
        return {
            'success': False,
            'error':   f"Prediction error: {str(e)}",
            'message': "An error occurred while making the prediction. Please verify your inputs and try again.",
        }


def predict_diabetes_risk_with_explanation(input_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Predict diabetes risk AND generate SHAP explanation with confidence interval.

    Wraps predict_diabetes_risk() and appends explainability data.
    """
    # Get the standard prediction first
    result = predict_diabetes_risk(input_data)
    if not result.get('success'):
        return result

    predictor = get_predictor()

    # Validate and clean inputs (reuse existing logic)
    _, _, cleaned_data = validate_inputs(input_data)

    try:
        import numpy as np

        features = np.array([[
            cleaned_data.get('pregnancies', DEFAULT_VALUES['pregnancies']),
            cleaned_data['glucose'],
            cleaned_data['blood_pressure'],
            cleaned_data.get('skin_thickness', np.nan),
            cleaned_data.get('insulin', np.nan),
            cleaned_data['bmi'],
            cleaned_data.get('diabetes_pedigree', DEFAULT_VALUES['diabetes_pedigree']),
            cleaned_data['age'],
        ]])

        # SHAP needs transformed features. Extract fitted inner pipeline from one calibration fold.
        inner_pipeline = predictor.pipeline.calibrated_classifiers_[0].estimator
        scaled_features = inner_pipeline[:-1].transform(features)  # engineer + imputer steps only

        # Get SHAP explanation
        from services.explainability_service import get_explainability_service
        explain_service = get_explainability_service()

        explanation = explain_service.explain_prediction(
            scaled_features, result['input_values']
        )
        confidence_interval = explain_service.compute_confidence_interval(
            scaled_features
        )

        result['explanation'] = explanation
        result['confidence_interval'] = confidence_interval

    except Exception as e:
        # If explanation fails, still return the prediction
        result['explanation'] = {'error': f"Explanation unavailable: {str(e)}"}
        result['confidence_interval'] = {'error': f"Confidence interval unavailable: {str(e)}"}

    return result


def get_feature_importance() -> Dict[str, Any]:
    """
    Get feature importance from the trained model.

    Returns:
        Dictionary with feature importance data
    """
    predictor = get_predictor()

    if not predictor.initialized:
        return {
            'success': False,
            'error': predictor.init_error
        }

    try:
        # Extract the inner RandomForest from the calibrated pipeline
        inner_pipeline = predictor.pipeline.calibrated_classifiers_[0].estimator
        inner_model = inner_pipeline[-1]  # last step is the classifier

        # Check if model has feature_importances_ (tree-based models)
        if hasattr(inner_model, 'feature_importances_'):
            importances = inner_model.feature_importances_

            # Create feature importance dictionary
            feature_importance = {}
            for i, feature in enumerate(FEATURE_ORDER):
                feature_importance[feature] = round(float(importances[i]), 4)

            # Sort by importance
            sorted_features = sorted(
                feature_importance.items(),
                key=lambda x: x[1],
                reverse=True
            )

            return {
                'success': True,
                'feature_importance': dict(sorted_features),
                'top_features': [f[0] for f in sorted_features[:3]]
            }
        else:
            return {
                'success': False,
                'error': "Model does not support feature importance"
            }

    except Exception as e:
        return {
            'success': False,
            'error': str(e)
        }


def get_prediction_thresholds() -> Dict[str, Any]:
    """
    Get the risk category thresholds.

    Returns:
        Dictionary with threshold information
    """
    return {
        'thresholds': {
            'low': {
                'max': RISK_THRESHOLDS['low'],
                'percentage': f"< {RISK_THRESHOLDS['low'] * 100:.0f}%",
                'description': "Lower risk - maintain healthy lifestyle"
            },
            'moderate': {
                'min': RISK_THRESHOLDS['low'],
                'max': RISK_THRESHOLDS['moderate'],
                'percentage': f"{RISK_THRESHOLDS['low'] * 100:.0f}% - {RISK_THRESHOLDS['moderate'] * 100:.0f}%",
                'description': "Moderate risk - consider lifestyle modifications"
            },
            'high': {
                'min': RISK_THRESHOLDS['moderate'],
                'percentage': f"> {RISK_THRESHOLDS['moderate'] * 100:.0f}%",
                'description': "Higher risk - consult healthcare provider"
            }
        },
        'disclaimer': DISCLAIMER
    }


def get_input_requirements() -> Dict[str, Any]:
    """
    Get information about required and optional inputs.

    Returns:
        Dictionary with input requirements
    """
    return {
        'required': {
            'glucose': {
                'name': 'Blood Glucose',
                'unit': 'mg/dL',
                'description': 'Fasting blood glucose level',
                'range': VALIDATION_RANGES['glucose']
            },
            'bmi': {
                'name': 'BMI',
                'unit': 'kg/m²',
                'description': 'Body Mass Index',
                'range': VALIDATION_RANGES['bmi']
            },
            'age': {
                'name': 'Age',
                'unit': 'years',
                'description': 'Age in years',
                'range': VALIDATION_RANGES['age']
            },
            'blood_pressure': {
                'name': 'Blood Pressure',
                'unit': 'mmHg',
                'description': 'Diastolic blood pressure',
                'range': VALIDATION_RANGES['blood_pressure']
            }
        },
        'optional': {
            'insulin': {
                'name': 'Insulin',
                'unit': 'μU/mL',
                'description': '2-hour serum insulin',
                'default': None,  # imputed by pipeline when absent
                'range': VALIDATION_RANGES['insulin']
            },
            'skin_thickness': {
                'name': 'Skin Thickness',
                'unit': 'mm',
                'description': 'Triceps skin fold thickness',
                'default': None,  # imputed by pipeline when absent
                'range': VALIDATION_RANGES['skin_thickness']
            },
            'pregnancies': {
                'name': 'Pregnancies',
                'unit': 'count',
                'description': 'Number of pregnancies',
                'default': DEFAULT_VALUES['pregnancies'],
                'range': VALIDATION_RANGES['pregnancies']
            },
            'diabetes_pedigree': {
                'name': 'Diabetes Pedigree Function',
                'unit': 'score',
                'description': 'Family history diabetes likelihood score',
                'default': DEFAULT_VALUES['diabetes_pedigree'],
                'range': VALIDATION_RANGES['diabetes_pedigree']
            }
        }
    }


def check_model_status() -> Dict[str, Any]:
    """
    Check if the ML model is loaded and ready.

    Returns:
        Dictionary with model status
    """
    predictor = get_predictor()

    return {
        'initialized':   predictor.initialized,
        'error':         predictor.init_error,
        'model_info':    predictor._get_model_info() if predictor.initialized else None,
        'pipeline_path': PIPELINE_PATH,
        'files_exist': {
            'pipeline': os.path.exists(PIPELINE_PATH),
            'metadata': os.path.exists(METADATA_PATH),
        },
    }
