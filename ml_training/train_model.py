"""
Blood Glucose Analyzer - ML Model Training Script
================================================
Trains a calibrated Random Forest pipeline for diabetes prediction
using the PIMA Indians Diabetes Dataset.

Author: Ishan
Project: Undergraduate CS Thesis - Healthcare Accessibility in Nepal
"""

import os
import numpy as np
import pandas as pd
from datetime import datetime

# Preprocessing
from sklearn.model_selection import train_test_split

# Models
from sklearn.ensemble import RandomForestClassifier

# Model persistence
import joblib

from sklearn.base import BaseEstimator, TransformerMixin
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline
from sklearn.calibration import CalibratedClassifierCV
from sklearn.model_selection import FixedThresholdClassifier

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
        glucose_bmi            = X[:, 1] * X[:, 5]  # Glucose × BMI
        age_insulin_resistance = X[:, 7] * X[:, 5]  # Age × BMI
        return np.column_stack([X, glucose_bmi, age_insulin_resistance])

# Constants
RANDOM_STATE = 42
TEST_SIZE = 0.2
DATA_URL = "https://raw.githubusercontent.com/jbrownlee/Datasets/master/pima-indians-diabetes.data.csv"

# Column names for the PIMA dataset
COLUMN_NAMES = [
    'Pregnancies',
    'Glucose',
    'BloodPressure',
    'SkinThickness',
    'Insulin',
    'BMI',
    'DiabetesPedigreeFunction',
    'Age',
    'Outcome'
]


def load_data():
    """Load the PIMA Indians Diabetes dataset."""
    print("=" * 60)
    print("LOADING DATA")
    print("=" * 60)

    # Try to load from local file first
    local_path = os.path.join(os.path.dirname(__file__), 'pima_diabetes.csv')

    if os.path.exists(local_path) and os.path.getsize(local_path) > 0:
        print(f"Loading from local file: {local_path}")
        df = pd.read_csv(local_path, header=None, names=COLUMN_NAMES)
    else:
        print(f"Downloading from: {DATA_URL}")
        df = pd.read_csv(DATA_URL, header=None, names=COLUMN_NAMES)
        # Save locally for future use
        df.to_csv(local_path, index=False, header=False)
        print(f"Saved to: {local_path}")

    print(f"\nDataset Shape: {df.shape}")
    print(f"Total Samples: {len(df)}")
    print(f"Features: {len(df.columns) - 1}")
    print(f"\nClass Distribution:")
    print(f"  - No Diabetes (0): {len(df[df['Outcome'] == 0])} ({len(df[df['Outcome'] == 0])/len(df)*100:.1f}%)")
    print(f"  - Diabetes (1): {len(df[df['Outcome'] == 1])} ({len(df[df['Outcome'] == 1])/len(df)*100:.1f}%)")

    return df


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


def build_pipeline():
    """Construct the calibrated sklearn pipeline (not yet fitted).

    Uses FixedThresholdClassifier(threshold=0.40) around the calibrated pipeline
    to achieve recall >= 0.60 on the PIMA dataset while preserving ROC-AUC >= 0.82.
    """
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
    calibrated = CalibratedClassifierCV(estimator=base_pipeline, method='sigmoid', cv=5)
    return FixedThresholdClassifier(estimator=calibrated, threshold=0.40)


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
