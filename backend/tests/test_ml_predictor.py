# backend/tests/test_ml_predictor.py
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

import pytest


def test_predictor_loads_pipeline():
    from services.ml_predictor import get_predictor
    p = get_predictor()
    assert p.initialized, p.init_error
    assert p.pipeline is not None


def test_predictor_has_no_active_scaler():
    from services.ml_predictor import get_predictor
    p = get_predictor()
    assert not hasattr(p, 'scaler') or p.scaler is None


def test_predict_required_fields_only():
    from services.ml_predictor import predict_diabetes_risk
    result = predict_diabetes_risk({
        'glucose': 120, 'bmi': 28.5, 'age': 33, 'blood_pressure': 70
    })
    assert result['success'] is True
    assert 0.0 <= result['risk_probability'] <= 1.0
    assert result['risk_category'] in ('Low', 'Moderate', 'High')


def test_predict_all_fields():
    from services.ml_predictor import predict_diabetes_risk
    result = predict_diabetes_risk({
        'glucose': 150, 'bmi': 35.0, 'age': 45, 'blood_pressure': 85,
        'insulin': 200, 'skin_thickness': 30, 'pregnancies': 3,
        'diabetes_pedigree': 0.5,
    })
    assert result['success'] is True


def test_predict_missing_required_returns_error():
    from services.ml_predictor import predict_diabetes_risk
    result = predict_diabetes_risk({'glucose': 120, 'bmi': 28.5})
    assert result['success'] is False
    assert 'validation_errors' in result


def test_no_scaler_pkl_in_source():
    import services.ml_predictor as mod
    src = open(mod.__file__).read()
    assert 'scaler.pkl' not in src, "scaler.pkl reference must be removed from ml_predictor.py"
