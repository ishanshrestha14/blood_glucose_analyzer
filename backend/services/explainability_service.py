"""
Explainability Service - SHAP-based Model Explanations & Confidence Intervals

Provides per-prediction feature explanations using SHAP TreeExplainer
and prediction confidence intervals using Random Forest tree variance.
"""

import numpy as np
from typing import Dict, Any, List, Optional


# Feature display names and units — covers all 10 features (8 base + 2 engineered)
FEATURE_DISPLAY = {
    'Pregnancies':             {'name': 'Number of Pregnancies', 'unit': ''},
    'Glucose':                 {'name': 'Blood Glucose Level',   'unit': 'mg/dL'},
    'BloodPressure':           {'name': 'Blood Pressure',        'unit': 'mmHg'},
    'SkinThickness':           {'name': 'Skin Thickness',        'unit': 'mm'},
    'Insulin':                 {'name': 'Insulin Level',         'unit': 'μU/mL'},
    'BMI':                     {'name': 'Body Mass Index (BMI)', 'unit': 'kg/m²'},
    'DiabetesPedigreeFunction':{'name': 'Family History Score',  'unit': ''},
    'Age':                     {'name': 'Age',                   'unit': 'years'},
    'Glucose_BMI':             {'name': 'Glucose × BMI',         'unit': ''},
    'Age_BMI':                 {'name': 'Age × BMI',             'unit': ''},
}

# All 10 features in the order the Random Forest sees them after engineering + imputation
ENGINEERED_FEATURE_ORDER = [
    'Pregnancies',
    'Glucose',
    'BloodPressure',
    'SkinThickness',
    'Insulin',
    'BMI',
    'DiabetesPedigreeFunction',
    'Age',
    'Glucose_BMI',
    'Age_BMI',
]

# Interaction features — handled differently in explanation text
INTERACTION_FEATURES = {'Glucose_BMI', 'Age_BMI'}

# Map API input field names to model feature names (base features only)
INPUT_TO_FEATURE = {
    'pregnancies':       'Pregnancies',
    'glucose':           'Glucose',
    'blood_pressure':    'BloodPressure',
    'skin_thickness':    'SkinThickness',
    'insulin':           'Insulin',
    'bmi':               'BMI',
    'diabetes_pedigree': 'DiabetesPedigreeFunction',
    'age':               'Age',
}


class ExplainabilityService:
    """SHAP-based model explainability with confidence intervals."""

    def __init__(self):
        self.explainer = None
        self.initialized = False
        self.init_error = None

    def _ensure_initialized(self) -> bool:
        """Lazy-initialize the SHAP explainer on first use."""
        if self.initialized:
            return True

        try:
            import shap
            from services.ml_predictor import get_predictor

            predictor = get_predictor()
            if not predictor.initialized:
                self.init_error = "ML model not initialized"
                return False

            # Extract the underlying RandomForestClassifier from the calibrated pipeline.
            # Structure: CalibratedClassifierCV → _CalibratedClassifier → Pipeline(named_steps)
            inner_rf = (
                predictor.pipeline
                .calibrated_classifiers_[0]
                .estimator
                .named_steps['model']
            )
            self.explainer = shap.TreeExplainer(inner_rf)
            self.initialized = True
            return True

        except Exception as e:
            self.init_error = f"Failed to initialize SHAP explainer: {str(e)}"
            return False

    def explain_prediction(
        self,
        scaled_features: np.ndarray,
        raw_values: Dict[str, float],
    ) -> Dict[str, Any]:
        """
        Generate SHAP explanation for a single prediction.

        Args:
            scaled_features: 1×10 numpy array (engineer + imputer applied)
            raw_values: dict of original input values (input_values from prediction)

        Returns:
            Dict with feature contributions, top factors, and plain English summary
        """
        if not self._ensure_initialized():
            return {'error': self.init_error}

        shap_values = self.explainer.shap_values(scaled_features)

        # SHAP output format varies by version:
        # - Older: list [class_0_array, class_1_array], each (n_samples, n_features)
        # - Newer: ndarray (n_samples, n_features, n_classes)
        # We want class 1 (diabetes risk) contributions.
        shap_arr = np.array(shap_values)
        if shap_arr.ndim == 3:
            contributions = shap_arr[0, :, 1]
        elif isinstance(shap_values, list) and len(shap_values) == 2:
            contributions = np.array(shap_values[1])[0]
        else:
            contributions = np.array(shap_values)[0]

        expected = self.explainer.expected_value
        if hasattr(expected, '__len__') and len(expected) > 1:
            base_value = float(expected[1])
        else:
            base_value = float(expected)

        feature_to_input = {v: k for k, v in INPUT_TO_FEATURE.items()}

        total_abs = float(np.sum(np.abs(contributions)))
        if total_abs == 0:
            total_abs = 1.0

        feature_contributions: List[Dict[str, Any]] = []
        for i, feature_name in enumerate(ENGINEERED_FEATURE_ORDER):
            shap_val = float(contributions[i])
            abs_pct = abs(shap_val) / total_abs * 100
            direction = 'risk' if shap_val > 0 else 'protective'

            display = FEATURE_DISPLAY.get(feature_name, {'name': feature_name, 'unit': ''})
            input_key = feature_to_input.get(feature_name, '')
            raw_val = raw_values.get(input_key, 0) if input_key else None

            explanation = self._generate_explanation(
                feature_name, display['name'], raw_val, display['unit'],
                direction, round(abs_pct, 1)
            )

            feature_contributions.append({
                'feature':          feature_name,
                'display_name':     display['name'],
                'shap_value':       round(shap_val, 4),
                'contribution_pct': round(abs_pct, 1),
                'direction':        direction,
                'raw_value':        raw_val if raw_val is not None else 0,
                'unit':             display['unit'],
                'explanation':      explanation,
            })

        feature_contributions.sort(key=lambda x: abs(x['shap_value']), reverse=True)

        top_risk       = [f for f in feature_contributions if f['direction'] == 'risk'][:3]
        top_protective = [f for f in feature_contributions if f['direction'] == 'protective'][:3]

        summary = self._generate_summary(top_risk, top_protective)

        return {
            'base_value':             round(base_value, 4),
            'feature_contributions':  feature_contributions,
            'top_risk_factors':       top_risk,
            'top_protective_factors': top_protective,
            'plain_english_summary':  summary,
        }

    def compute_confidence_interval(
        self,
        scaled_features: np.ndarray,
        confidence_level: float = 0.95,
    ) -> Dict[str, Any]:
        """
        Compute prediction confidence interval using RF tree variance.

        Each tree in the Random Forest gives its own predict_proba.
        The variance across trees quantifies prediction uncertainty.
        """
        from services.ml_predictor import get_predictor

        predictor = get_predictor()
        if not predictor.initialized:
            return {'error': 'Model not initialized'}

        inner_rf = (
            predictor.pipeline
            .calibrated_classifiers_[0]
            .estimator
            .named_steps['model']
        )

        tree_predictions = []
        for tree in inner_rf.estimators_:
            tree_pred = tree.predict_proba(scaled_features)[0][1]
            tree_predictions.append(tree_pred)

        tree_predictions = np.array(tree_predictions)
        mean_pred = float(np.mean(tree_predictions))
        std_pred  = float(np.std(tree_predictions))

        z = 1.96  # 95% CI
        ci_lower = max(0.0, mean_pred - z * std_pred)
        ci_upper = min(1.0, mean_pred + z * std_pred)

        return {
            'mean':             round(mean_pred, 4),
            'std':              round(std_pred, 4),
            'ci_lower':         round(ci_lower, 4),
            'ci_upper':         round(ci_upper, 4),
            'ci_lower_pct':     round(ci_lower * 100, 1),
            'ci_upper_pct':     round(ci_upper * 100, 1),
            'confidence_level': confidence_level,
            'tree_count':       len(inner_rf.estimators_),
        }

    def _generate_explanation(
        self,
        feature_name: str,
        name: str,
        value: Optional[float],
        unit: str,
        direction: str,
        pct: float,
    ) -> str:
        """Generate a patient-friendly explanation for one feature."""
        if feature_name in INTERACTION_FEATURES:
            if direction == 'risk':
                return f"The {name} interaction increased your risk score by {pct}%"
            else:
                return f"The {name} interaction decreased your risk score by {pct}%"

        value_str = ""
        if value is not None:
            value_str = f" of {value:.0f}" if value == int(value) else f" of {value:.1f}"
            if unit:
                value_str += f" {unit}"

        if direction == 'risk':
            return f"Your {name}{value_str} increased your risk score by {pct}%"
        else:
            return f"Your {name}{value_str} decreased your risk score by {pct}%"

    def _generate_summary(
        self, risk_factors: List[Dict], protective_factors: List[Dict]
    ) -> str:
        """Generate an overall plain English summary."""
        parts = []

        if risk_factors:
            names = [f['display_name'] for f in risk_factors]
            if len(names) == 1:
                parts.append(f"The main factor increasing your risk is your {names[0]}.")
            else:
                joined = ", ".join(names[:-1]) + f" and {names[-1]}"
                parts.append(f"The main factors increasing your risk are your {joined}.")

        if protective_factors:
            names = [f['display_name'] for f in protective_factors]
            if len(names) == 1:
                parts.append(f"Your {names[0]} is helping lower your risk.")
            else:
                joined = ", ".join(names[:-1]) + f" and {names[-1]}"
                parts.append(f"Your {joined} are helping lower your risk.")

        if not parts:
            return "Your health indicators show a balanced risk profile."

        return " ".join(parts)


# Singleton instance
_explainability_instance: Optional[ExplainabilityService] = None


def get_explainability_service() -> ExplainabilityService:
    """Get or create the explainability service singleton."""
    global _explainability_instance
    if _explainability_instance is None:
        _explainability_instance = ExplainabilityService()
    return _explainability_instance
