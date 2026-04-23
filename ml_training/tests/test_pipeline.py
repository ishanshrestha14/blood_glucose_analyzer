import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

import numpy as np
import pytest

from train_model import FeatureEngineer

# 8 features: Pregnancies(0), Glucose(1), BloodPressure(2), SkinThickness(3),
#              Insulin(4), BMI(5), DiabetesPedigreeFunction(6), Age(7)
SAMPLE_ROW = np.array([[2, 120.0, 70.0, 20.0, 80.0, 28.5, 0.47, 33.0]])
ZERO_ROW   = np.array([[0, 0.0,   0.0,  0.0,  0.0,  0.0,  0.3,  25.0]])


def test_output_shape():
    out = FeatureEngineer().fit_transform(SAMPLE_ROW)
    assert out.shape == (1, 10), f"Expected (1, 10), got {out.shape}"


def test_glucose_bmi_feature():
    out = FeatureEngineer().fit_transform(SAMPLE_ROW)
    expected = 120.0 * 28.5  # Glucose × BMI
    assert abs(out[0, 8] - expected) < 1e-6, f"glucose_bmi: {out[0,8]} != {expected}"


def test_age_insulin_resistance_feature():
    out = FeatureEngineer().fit_transform(SAMPLE_ROW)
    expected = 33.0 * 28.5  # Age × BMI
    assert abs(out[0, 9] - expected) < 1e-6, f"age_bmi: {out[0,9]} != {expected}"


def test_zero_invalid_cols_become_nan():
    """Indices 1,2,3,4,5 (Glucose,BP,SkinThickness,Insulin,BMI) must become NaN when 0."""
    out = FeatureEngineer().fit_transform(ZERO_ROW)
    for idx in [1, 2, 3, 4, 5]:
        assert np.isnan(out[0, idx]), f"col {idx} should be NaN when input is 0"


def test_pregnancies_zero_stays_zero():
    """Pregnancies=0 is biologically valid and must not become NaN."""
    out = FeatureEngineer().fit_transform(ZERO_ROW)
    assert out[0, 0] == 0.0, "Pregnancies=0 must remain 0"


def test_fit_returns_self():
    eng = FeatureEngineer()
    assert eng.fit(SAMPLE_ROW) is eng
