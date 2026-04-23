"""
Feature engineering transformer for the diabetes prediction pipeline.

This class must mirror the one used during training (ml_training/train_model.py)
exactly — including ZERO_INVALID_INDICES — so that the pickled pipeline can be
unpickled correctly. When joblib loads diabetes_pipeline.pkl it looks for
FeatureEngineer on the module recorded at pickle-time (__main__), so _load_models
in ml_predictor.py patches sys.modules['__main__'] before calling joblib.load.
"""

import numpy as np
from sklearn.base import BaseEstimator, TransformerMixin

# Column indices where 0 means "data missing" (biologically impossible).
# Pregnancies (index 0) is intentionally excluded — 0 pregnancies is valid.
ZERO_INVALID_INDICES = [1, 2, 3, 4, 5]  # Glucose, BloodPressure, SkinThickness, Insulin, BMI


class FeatureEngineer(BaseEstimator, TransformerMixin):
    """Converts impossible zeros to NaN and appends two interaction features."""

    def fit(self, X, y=None):
        return self

    def transform(self, X):
        X = np.array(X, dtype=float).copy()
        for idx in ZERO_INVALID_INDICES:
            X[:, idx] = np.where(X[:, idx] == 0, np.nan, X[:, idx])
        glucose_bmi            = X[:, 1] * X[:, 5]  # Glucose × BMI
        age_insulin_resistance = X[:, 7] * X[:, 5]  # Age × BMI
        return np.column_stack([X, glucose_bmi, age_insulin_resistance])
