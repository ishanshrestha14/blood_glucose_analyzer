# ML Pipeline Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the split `diabetes_model.pkl` + `scaler.pkl` artifacts with a single `CalibratedClassifierCV(Pipeline(...))` that handles feature engineering, imputation, and calibrated probability output, eliminating all training/inference mismatch.

**Architecture:** A `FeatureEngineer` transformer converts biologically-impossible zeros to NaN and appends two interaction features (8→10). A `SimpleImputer(median)` fills NaN. A `RandomForestClassifier(class_weight='balanced')` learns on the result. This `Pipeline` is wrapped by `CalibratedClassifierCV(method='sigmoid', cv=5)` so preprocessing happens inside each CV fold — no leakage. At inference, `ml_predictor.py` passes a raw 8-feature numpy array (NaN for missing optional fields) directly to `pipeline.predict_proba()`.

**Tech Stack:** scikit-learn 1.8.0, joblib, numpy, pandas — all present in `backend/venv`. Run training from `ml_training/` using that same venv (`source ../backend/venv/bin/activate`).

---

## File Map

| File | Action |
|------|--------|
| `ml_training/train_model.py` | Rewrite: add `FeatureEngineer`, replace `preprocess_data()`, `train_models()`, `save_model()`, `main()` |
| `ml_training/tests/__init__.py` | Create (empty) |
| `ml_training/tests/test_pipeline.py` | Create: unit + integration tests for `FeatureEngineer` and full pipeline |
| `backend/services/ml_predictor.py` | Update: load `diabetes_pipeline.pkl`, remove scaler, pass NaN for missing optionals |
| `backend/tests/__init__.py` | Create (empty) |
| `backend/tests/test_ml_predictor.py` | Create: unit tests for updated predictor |
| `backend/models/diabetes_pipeline.pkl` | Created by running `train_model.py` |
| `backend/models/model_metadata.pkl` | Updated (pipeline_version=2, calibration_method, recall, roc_auc) |
| `backend/models/diabetes_model.pkl` | Deleted by `save_pipeline()` |
| `backend/models/scaler.pkl` | Deleted by `save_pipeline()` |

---

### Task 1: Write failing tests for FeatureEngineer

**Files:**
- Create: `ml_training/tests/__init__.py`
- Create: `ml_training/tests/test_pipeline.py`

- [ ] **Step 1: Create test files**

```python
# ml_training/tests/__init__.py
# (empty)
```

```python
# ml_training/tests/test_pipeline.py
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
```

- [ ] **Step 2: Run tests to confirm they fail (FeatureEngineer not yet defined)**

```bash
cd ml_training
source ../backend/venv/bin/activate
python -m pytest tests/test_pipeline.py -v
```

Expected: `ImportError: cannot import name 'FeatureEngineer' from 'train_model'`

---

### Task 2: Implement FeatureEngineer in train_model.py

**Files:**
- Modify: `ml_training/train_model.py`

- [ ] **Step 1: Add new imports and FeatureEngineer class after the existing `import joblib` line**

```python
from sklearn.base import BaseEstimator, TransformerMixin
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline
from sklearn.calibration import CalibratedClassifierCV

# Column indices where 0 means "data missing" (biologically impossible)
# Pregnancies(0) is intentionally excluded — 0 is valid there.
ZERO_INVALID_INDICES = [1, 2, 3, 4, 5]  # Glucose, BloodPressure, SkinThickness, Insulin, BMI


class FeatureEngineer(BaseEstimator, TransformerMixin):
    """Converts impossible zeros to NaN and appends two interaction features."""

    def fit(self, X, y=None):
        return self

    def transform(self, X):
        X = np.array(X, dtype=float).copy()
        for idx in ZERO_INVALID_INDICES:
            X[:, idx] = np.where(X[:, idx] == 0, np.nan, X[:, idx])
        glucose_bmi           = X[:, 1] * X[:, 5]  # Glucose × BMI
        age_insulin_resistance = X[:, 7] * X[:, 5]  # Age × BMI
        return np.column_stack([X, glucose_bmi, age_insulin_resistance])
```

- [ ] **Step 2: Run tests — all 6 must pass**

```bash
python -m pytest tests/test_pipeline.py -v
```

Expected: 6 tests PASS.

- [ ] **Step 3: Commit**

```bash
git add ml_training/train_model.py ml_training/tests/
git commit -m "feat: add FeatureEngineer transformer with zero→NaN conversion and interaction features"
```

---

### Task 3: Rewrite preprocess_data() and replace train/evaluate/save functions

**Files:**
- Modify: `ml_training/train_model.py`

- [ ] **Step 1: Replace preprocess_data()**

Replace the entire existing `preprocess_data()` function with:

```python
def preprocess_data(df):
    """Replace biologically-impossible zeros with NaN; split into train/test arrays."""
    print("\n" + "=" * 60)
    print("PREPROCESSING DATA")
    print("=" * 60)

    df_processed = df.copy()
    zero_invalid_cols = ['Glucose', 'BloodPressure', 'SkinThickness', 'Insulin', 'BMI']
    print("\nConverting invalid zeros to NaN (pipeline imputer will fill these):")
    for col in zero_invalid_cols:
        count = (df_processed[col] == 0).sum()
        df_processed[col] = df_processed[col].replace(0, np.nan)
        print(f"  - {col}: {count} zeros → NaN")

    X = df_processed.drop('Outcome', axis=1).values  # shape (768, 8)
    y = df_processed['Outcome'].values

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=TEST_SIZE, random_state=RANDOM_STATE, stratify=y
    )
    print(f"\nSplit: {len(X_train)} train / {len(X_test)} test (stratified, random_state={RANDOM_STATE})")
    return X_train, X_test, y_train, y_test
```

- [ ] **Step 2: Replace train_models() with build_pipeline() and train_pipeline()**

Remove the existing `train_models()` function and add:

```python
def build_pipeline():
    """Construct the calibrated sklearn pipeline (not yet fitted)."""
    base_pipeline = Pipeline([
        ('engineer', FeatureEngineer()),
        ('imputer',  SimpleImputer(strategy='median')),
        ('model',    RandomForestClassifier(
            n_estimators=100,
            class_weight='balanced',
            random_state=RANDOM_STATE,
            n_jobs=-1,
        )),
    ])
    return CalibratedClassifierCV(estimator=base_pipeline, method='sigmoid', cv=5)


def train_pipeline(X_train, y_train):
    """Fit the calibrated pipeline."""
    print("\n" + "=" * 60)
    print("TRAINING PIPELINE")
    print("=" * 60)
    print("Fitting CalibratedClassifierCV(Pipeline(FeatureEngineer→Imputer→RF), method='sigmoid', cv=5)...")
    pipeline = build_pipeline()
    pipeline.fit(X_train, y_train)
    print("Training complete.")
    return pipeline
```

- [ ] **Step 3: Replace evaluate_all_models() with evaluate_pipeline()**

Remove `evaluate_all_models()`, `evaluate_model()`, and `find_best_model()`. Add:

```python
def evaluate_pipeline(pipeline, X_test, y_test):
    """Evaluate calibrated pipeline; return metrics dict."""
    from sklearn.metrics import (
        accuracy_score, recall_score, roc_auc_score, classification_report
    )
    y_pred = pipeline.predict(X_test)
    y_prob = pipeline.predict_proba(X_test)[:, 1]
    metrics = {
        'accuracy': accuracy_score(y_test, y_pred),
        'recall':   recall_score(y_test, y_pred),
        'roc_auc':  roc_auc_score(y_test, y_prob),
    }
    print(f"\nPipeline Evaluation:")
    print(f"  Accuracy:  {metrics['accuracy']*100:.2f}%")
    print(f"  Recall:    {metrics['recall']:.4f}  (target ≥ 0.60)")
    print(f"  ROC-AUC:   {metrics['roc_auc']:.4f}  (target ≥ 0.82)")
    print("\nClassification Report:")
    print(classification_report(y_test, y_pred, target_names=['No Diabetes', 'Diabetes']))
    return metrics
```

- [ ] **Step 4: Replace save_model() with save_pipeline()**

Remove the existing `save_model()` function. Add:

```python
def save_pipeline(pipeline, metrics):
    """Save calibrated pipeline + updated metadata; delete old split artifacts."""
    print("\n" + "=" * 60)
    print("SAVING PIPELINE")
    print("=" * 60)

    current_dir = os.path.dirname(os.path.abspath(__file__))
    models_dir  = os.path.normpath(os.path.join(current_dir, '..', 'backend', 'models'))
    os.makedirs(models_dir, exist_ok=True)

    pipeline_path = os.path.join(models_dir, 'diabetes_pipeline.pkl')
    joblib.dump(pipeline, pipeline_path, compress=3)
    print(f"Pipeline saved: {pipeline_path}  ({os.path.getsize(pipeline_path)/1024:.1f} KB)")

    metadata = {
        'pipeline_version':    2,
        'model_name':          'CalibratedRandomForest',
        'feature_names':       COLUMN_NAMES[:-1],
        'features':            COLUMN_NAMES[:-1],
        'engineered_features': ['glucose_bmi', 'age_insulin_resistance'],
        'calibration_method':  'sigmoid',
        'training_date':       datetime.now().isoformat(),
        'random_state':        RANDOM_STATE,
        'test_size':           TEST_SIZE,
        'accuracy':            metrics['accuracy'],
        'roc_auc':             metrics['roc_auc'],
        'recall':              metrics['recall'],
        'dataset':             'Pima Indians Diabetes Dataset',
    }
    metadata_path = os.path.join(models_dir, 'model_metadata.pkl')
    joblib.dump(metadata, metadata_path, compress=3)
    print(f"Metadata saved: {metadata_path}")

    for old_name in ['diabetes_model.pkl', 'scaler.pkl']:
        old_path = os.path.join(models_dir, old_name)
        if os.path.exists(old_path):
            os.remove(old_path)
            print(f"Deleted old artifact: {old_name}")

    return pipeline_path
```

- [ ] **Step 5: Replace main()**

Replace the entire existing `main()` function with:

```python
def main():
    print("\n" + "=" * 60)
    print("BLOOD GLUCOSE ANALYZER — ML PIPELINE TRAINING (v2)")
    print("=" * 60)

    df = load_data()
    X_train, X_test, y_train, y_test = preprocess_data(df)
    pipeline = train_pipeline(X_train, y_train)
    metrics  = evaluate_pipeline(pipeline, X_test, y_test)

    assert metrics['roc_auc'] >= 0.82, \
        f"ROC-AUC {metrics['roc_auc']:.4f} below threshold 0.82"
    assert metrics['recall'] >= 0.60, \
        f"Recall {metrics['recall']:.4f} below threshold 0.60"
    print("\n✓ Performance thresholds met.")

    save_pipeline(pipeline, metrics)

    print("\n" + "=" * 60)
    print("TRAINING COMPLETE")
    print("=" * 60)


if __name__ == '__main__':
    main()
```

Also remove `print_thesis_summary()` — it referenced the old multi-model structure and is no longer needed.

- [ ] **Step 6: Run full training script**

```bash
cd ml_training
source ../backend/venv/bin/activate
python3 train_model.py
```

Expected output (key lines):
```
Converting invalid zeros to NaN ...
  - Glucose: 5 zeros → NaN
  - BloodPressure: 35 zeros → NaN
  - SkinThickness: 227 zeros → NaN
  - Insulin: 374 zeros → NaN
  - BMI: 11 zeros → NaN
Split: 614 train / 154 test (stratified, random_state=42)
Fitting CalibratedClassifierCV(...)
Training complete.
  Accuracy:  7X.XX%
  Recall:    0.6X+
  ROC-AUC:   0.8X+
✓ Performance thresholds met.
Pipeline saved: .../backend/models/diabetes_pipeline.pkl
Metadata saved: .../backend/models/model_metadata.pkl
Deleted old artifact: diabetes_model.pkl
Deleted old artifact: scaler.pkl
TRAINING COMPLETE
```

- [ ] **Step 7: Verify artifacts on disk**

```bash
ls -lh ../backend/models/
python3 -c "
import joblib
m = joblib.load('../backend/models/model_metadata.pkl')
print('pipeline_version:',    m['pipeline_version'])
print('calibration_method:',  m['calibration_method'])
print('engineered_features:', m['engineered_features'])
print('recall:',  m['recall'])
print('roc_auc:', m['roc_auc'])
"
```

Expected: `pipeline_version: 2`, `calibration_method: sigmoid`, no `diabetes_model.pkl` or `scaler.pkl` in listing.

- [ ] **Step 8: Add pipeline integration tests**

Append to `ml_training/tests/test_pipeline.py`:

```python
import pandas as pd


def _load_df():
    csv_path = os.path.join(os.path.dirname(__file__), '..', 'pima_diabetes.csv')
    cols = ['Pregnancies', 'Glucose', 'BloodPressure', 'SkinThickness',
            'Insulin', 'BMI', 'DiabetesPedigreeFunction', 'Age', 'Outcome']
    return pd.read_csv(csv_path, header=None, names=cols)


def test_pipeline_predict_proba_shape():
    from train_model import build_pipeline, preprocess_data
    df = _load_df()
    X_train, X_test, y_train, _ = preprocess_data(df)
    pipe = build_pipeline()
    pipe.fit(X_train, y_train)
    proba = pipe.predict_proba(X_test)
    assert proba.shape == (len(X_test), 2)
    assert np.allclose(proba.sum(axis=1), 1.0)


def test_pipeline_handles_nan_at_inference():
    """Pipeline must not raise when optional fields arrive as NaN."""
    from train_model import build_pipeline, preprocess_data
    df = _load_df()
    X_train, _, y_train, _ = preprocess_data(df)
    pipe = build_pipeline()
    pipe.fit(X_train, y_train)
    row = np.array([[2, 120.0, 70.0, np.nan, np.nan, 28.5, 0.47, 33.0]])
    proba = pipe.predict_proba(row)
    assert proba.shape == (1, 2)
    assert 0.0 < proba[0, 1] < 1.0


def test_pipeline_is_cloneable():
    """CalibratedClassifierCV requires the estimator to be cloneable."""
    from sklearn.base import clone
    from train_model import build_pipeline
    clone(build_pipeline())  # raises if not properly parameterized
```

- [ ] **Step 9: Run all pipeline tests**

```bash
python -m pytest tests/test_pipeline.py -v
```

Expected: all 9 tests PASS.

- [ ] **Step 10: Commit**

```bash
git add ml_training/train_model.py ml_training/tests/test_pipeline.py
git commit -m "feat: refactor training to CalibratedClassifierCV pipeline — balanced RF, median imputation, sigmoid calibration"
```

---

### Task 4: Update ml_predictor.py — load pipeline, remove scaler

**Files:**
- Modify: `backend/services/ml_predictor.py`

- [ ] **Step 1: Write failing backend predictor tests**

```python
# backend/tests/__init__.py
# (empty)
```

```python
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


def test_predictor_has_no_scaler_attribute():
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
```

- [ ] **Step 2: Run to confirm current failures**

```bash
cd backend
source venv/bin/activate
python -m pytest tests/test_ml_predictor.py -v 2>&1 | head -40
```

Expected: `test_predictor_loads_pipeline` fails (no `p.pipeline`), `test_no_scaler_pkl_in_source` fails.

- [ ] **Step 3: Replace file-path constants and MLPredictor class**

In `backend/services/ml_predictor.py`, replace lines 16–22 (the `CURRENT_DIR … MODEL_PATH … SCALER_PATH … METADATA_PATH` block) with:

```python
CURRENT_DIR   = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR   = os.path.dirname(CURRENT_DIR)
MODELS_DIR    = os.path.join(BACKEND_DIR, 'models')

PIPELINE_PATH = os.path.join(MODELS_DIR, 'diabetes_pipeline.pkl')
METADATA_PATH = os.path.join(MODELS_DIR, 'model_metadata.pkl')
```

Replace the `FEATURE_ORDER` list (keep same 8 names, just for documentation):

```python
FEATURE_ORDER = [
    'Pregnancies', 'Glucose', 'BloodPressure', 'SkinThickness',
    'Insulin', 'BMI', 'DiabetesPedigreeFunction', 'Age',
]
```

Replace `DEFAULT_VALUES` (remove insulin and skin_thickness — those become NaN now):

```python
DEFAULT_VALUES = {
    'pregnancies':      0.0,     # 0 pregnancies is biologically valid
    'diabetes_pedigree': 0.3725, # median from PIMA dataset
}
```

Replace the entire `MLPredictor` class:

```python
class MLPredictor:
    """Diabetes risk prediction using a calibrated sklearn pipeline."""

    def __init__(self):
        self.pipeline  = None
        self.scaler    = None   # kept as None — pipeline handles scaling internally
        self.metadata  = None
        self.initialized = False
        self.init_error  = None
        self._load_models()

    def _load_models(self):
        if not os.path.exists(PIPELINE_PATH):
            self.init_error = f"Pipeline file not found: {PIPELINE_PATH}"
            return
        try:
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
```

- [ ] **Step 4: Replace predict_diabetes_risk() body**

Keep the function signature and docstring. Replace everything from `# Get predictor instance` through the final `return` with:

```python
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
```

- [ ] **Step 5: Update predict_diabetes_risk_with_explanation() — replace scaler.transform()**

In `predict_diabetes_risk_with_explanation()`, find the block (lines ~428–443) that builds `features_array` and calls `predictor.scaler.transform(features_array)`. Replace the entire block with:

```python
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

        # SHAP needs the transformed (post-engineer + post-imputer) features.
        # Extract the fitted inner pipeline from one of the calibration folds.
        inner_pipeline = predictor.pipeline.calibrated_classifiers_[0].estimator
        scaled_features = inner_pipeline[:-1].transform(features)  # engineer + imputer steps only
```

- [ ] **Step 6: Update check_model_status() — replace MODEL_PATH/SCALER_PATH references**

Replace the `return` dict in `check_model_status()` with:

```python
    return {
        'initialized':  predictor.initialized,
        'error':        predictor.init_error,
        'model_info':   predictor._get_model_info() if predictor.initialized else None,
        'pipeline_path': PIPELINE_PATH,
        'files_exist': {
            'pipeline': os.path.exists(PIPELINE_PATH),
            'metadata': os.path.exists(METADATA_PATH),
        },
    }
```

- [ ] **Step 7: Run backend predictor tests — all must pass**

```bash
cd backend
source venv/bin/activate
python -m pytest tests/test_ml_predictor.py -v
```

Expected: all 6 tests PASS.

- [ ] **Step 8: Commit**

```bash
git add backend/services/ml_predictor.py backend/tests/
git commit -m "feat: update ml_predictor to load calibrated pipeline, pass NaN for missing optional fields, remove scaler"
```

---

### Task 5: Integration test — live Flask endpoint

**Files:**
- No new files — manual smoke test

- [ ] **Step 1: Start the backend**

```bash
cd backend
source venv/bin/activate
python3 app.py &
sleep 3
```

- [ ] **Step 2: Test with required fields only**

```bash
curl -s -X POST http://localhost:5000/api/predict-risk \
  -H "Content-Type: application/json" \
  -d '{"glucose": 120, "bmi": 28.5, "age": 33, "blood_pressure": 70}' \
  | python3 -m json.tool
```

Expected: `"success": true`, `"risk_category"` is `"Low"`, `"Moderate"`, or `"High"`, `"risk_probability"` is a float between 0 and 1.

- [ ] **Step 3: Test with all fields (higher-risk profile)**

```bash
curl -s -X POST http://localhost:5000/api/predict-risk \
  -H "Content-Type: application/json" \
  -d '{"glucose": 180, "bmi": 38.0, "age": 50, "blood_pressure": 90, "insulin": 200, "skin_thickness": 35, "pregnancies": 5, "diabetes_pedigree": 0.8}' \
  | python3 -m json.tool
```

Expected: `"success": true`, higher `"risk_probability"` than Step 2.

- [ ] **Step 4: Confirm no scaler.pkl reference anywhere in backend**

```bash
grep -r "scaler\.pkl" backend/services/ backend/app.py
```

Expected: no output.

- [ ] **Step 5: Stop backend and do final commit**

```bash
kill %1
git add -A
git commit -m "chore: verify pipeline end-to-end via Flask predict-risk endpoint"
```

---

## Self-Review

**Spec coverage:**
- ✅ `FeatureEngineer` (8→10, `glucose_bmi`, `age_insulin_resistance`): Tasks 1–2
- ✅ `SimpleImputer(strategy='median')` for all 5 zero-invalid cols: Task 3
- ✅ `RandomForestClassifier(class_weight='balanced')`: Task 3
- ✅ `CalibratedClassifierCV(method='sigmoid', cv=5)`: Task 3
- ✅ No `StandardScaler`: never added to pipeline
- ✅ No duplicate preprocessing in `ml_predictor.py`: Task 4 — only `pipeline.predict_proba(raw)`
- ✅ No data leakage (preprocessing inside CV folds): `CalibratedClassifierCV(estimator=base_pipeline)` clones the full pipeline per fold
- ✅ Save only `diabetes_pipeline.pkl`: Task 3 `save_pipeline()`
- ✅ Delete `diabetes_model.pkl` and `scaler.pkl`: Task 3 `save_pipeline()`
- ✅ Metadata: `pipeline_version=2`, `engineered_features`, `calibration_method`, `roc_auc`, `recall`, `accuracy`: Task 3
- ✅ `ml_predictor.py` loads `diabetes_pipeline.pkl`: Task 4 Step 3
- ✅ Inference: `pipeline.predict_proba(raw_input)` only: Task 4 Step 4
- ✅ NaN for missing optional fields: Task 4 Step 4
- ✅ Remove `DEFAULT_VALUES` for `insulin`/`skin_thickness`: Task 4 Step 3
- ✅ Remove `scaler.transform()` from `with_explanation`: Task 4 Step 5
- ✅ ROC-AUC ≥ 0.82 / Recall ≥ 0.60 assertions: Task 3 Step 5
- ✅ Backend endpoint test: Task 5

**Type consistency:** `build_pipeline()` → `CalibratedClassifierCV` used as `pipeline` throughout. `predictor.pipeline` set in Task 4 Step 3, used in Step 4. `DEFAULT_VALUES` defined in Task 4 Step 3 with only `pregnancies` and `diabetes_pedigree`, used in Step 4. `inner_pipeline[:-1]` slice consistent with Pipeline step order `(engineer, imputer, model)`.
