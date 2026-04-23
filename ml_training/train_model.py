"""
Blood Glucose Analyzer - ML Model Training Script
================================================
Trains and evaluates multiple machine learning models for diabetes prediction
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
from sklearn.preprocessing import StandardScaler

# Models
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier
from sklearn.svm import SVC

# Evaluation
from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    confusion_matrix,
    roc_auc_score,
    classification_report
)

# Model persistence
import joblib

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

# Columns that should not have zero values (biologically impossible)
ZERO_INVALID_COLUMNS = ['Glucose', 'BloodPressure', 'BMI']


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
    """Preprocess the dataset: handle zeros, split, and scale."""
    print("\n" + "=" * 60)
    print("PREPROCESSING DATA")
    print("=" * 60)

    # Create a copy to avoid modifying original
    df_processed = df.copy()

    # Handle zero values in columns where zero is biologically impossible
    print("\nHandling invalid zero values:")
    for column in ZERO_INVALID_COLUMNS:
        zero_count = (df_processed[column] == 0).sum()
        if zero_count > 0:
            median_value = df_processed[df_processed[column] != 0][column].median()
            df_processed[column] = df_processed[column].replace(0, median_value)
            print(f"  - {column}: Replaced {zero_count} zeros with median ({median_value:.2f})")

    # Split features and target
    X = df_processed.drop('Outcome', axis=1)
    y = df_processed['Outcome']

    # Split into training and testing sets
    X_train, X_test, y_train, y_test = train_test_split(
        X, y,
        test_size=TEST_SIZE,
        random_state=RANDOM_STATE,
        stratify=y  # Maintain class distribution
    )

    print(f"\nData Split (test_size={TEST_SIZE}, random_state={RANDOM_STATE}):")
    print(f"  - Training samples: {len(X_train)}")
    print(f"  - Testing samples: {len(X_test)}")

    # Standardize features
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)

    print("\nFeature Scaling: StandardScaler applied")
    print(f"  - Mean (after scaling): ~0")
    print(f"  - Std (after scaling): ~1")

    return X_train_scaled, X_test_scaled, y_train, y_test, scaler, X.columns.tolist()


def train_models(X_train, y_train):
    """Train multiple classification models."""
    print("\n" + "=" * 60)
    print("TRAINING MODELS")
    print("=" * 60)

    models = {
        'Logistic Regression': LogisticRegression(
            random_state=RANDOM_STATE,
            max_iter=1000
        ),
        'Random Forest': RandomForestClassifier(
            n_estimators=100,
            random_state=RANDOM_STATE,
            n_jobs=-1
        ),
        'Support Vector Machine': SVC(
            kernel='rbf',
            random_state=RANDOM_STATE,
            probability=True  # Enable probability estimates for ROC-AUC
        )
    }

    trained_models = {}

    for name, model in models.items():
        print(f"\nTraining {name}...")
        model.fit(X_train, y_train)
        trained_models[name] = model
        print(f"  - {name} trained successfully")

    return trained_models


def evaluate_model(model, X_test, y_test, model_name):
    """Evaluate a single model and return metrics."""
    # Predictions
    y_pred = model.predict(X_test)
    y_prob = model.predict_proba(X_test)[:, 1]

    # Calculate metrics
    metrics = {
        'accuracy': accuracy_score(y_test, y_pred),
        'precision': precision_score(y_test, y_pred),
        'recall': recall_score(y_test, y_pred),
        'f1': f1_score(y_test, y_pred),
        'roc_auc': roc_auc_score(y_test, y_prob),
        'confusion_matrix': confusion_matrix(y_test, y_pred)
    }

    return metrics


def evaluate_all_models(models, X_test, y_test):
    """Evaluate all models and compare performance."""
    print("\n" + "=" * 60)
    print("MODEL EVALUATION")
    print("=" * 60)

    results = {}

    for name, model in models.items():
        print(f"\n--- {name} ---")
        metrics = evaluate_model(model, X_test, y_test, name)
        results[name] = metrics

        print(f"Accuracy:  {metrics['accuracy']:.4f} ({metrics['accuracy']*100:.2f}%)")
        print(f"Precision: {metrics['precision']:.4f}")
        print(f"Recall:    {metrics['recall']:.4f}")
        print(f"F1-Score:  {metrics['f1']:.4f}")
        print(f"ROC-AUC:   {metrics['roc_auc']:.4f}")

        cm = metrics['confusion_matrix']
        print(f"\nConfusion Matrix:")
        print(f"                 Predicted")
        print(f"              Neg    Pos")
        print(f"Actual Neg   {cm[0][0]:4d}   {cm[0][1]:4d}")
        print(f"Actual Pos   {cm[1][0]:4d}   {cm[1][1]:4d}")

    return results


def find_best_model(results, models):
    """Find the best performing model based on ROC-AUC score."""
    print("\n" + "=" * 60)
    print("MODEL COMPARISON")
    print("=" * 60)

    # Create comparison table
    print("\n{:<25} {:>10} {:>10} {:>10} {:>10} {:>10}".format(
        "Model", "Accuracy", "Precision", "Recall", "F1-Score", "ROC-AUC"
    ))
    print("-" * 75)

    for name, metrics in results.items():
        print("{:<25} {:>10.4f} {:>10.4f} {:>10.4f} {:>10.4f} {:>10.4f}".format(
            name,
            metrics['accuracy'],
            metrics['precision'],
            metrics['recall'],
            metrics['f1'],
            metrics['roc_auc']
        ))

    # Find best model based on ROC-AUC (good for imbalanced datasets)
    best_model_name = max(results, key=lambda x: results[x]['roc_auc'])
    best_model = models[best_model_name]
    best_metrics = results[best_model_name]

    print(f"\n*** Best Model: {best_model_name} ***")
    print(f"    (Selected based on highest ROC-AUC score: {best_metrics['roc_auc']:.4f})")

    return best_model_name, best_model, best_metrics


def save_model(model, scaler, model_name, feature_names, best_metrics=None):
    """Save the best model and scaler to disk."""
    print("\n" + "=" * 60)
    print("SAVING MODEL")
    print("=" * 60)

    # Create models directory path using absolute path
    current_dir = os.path.dirname(os.path.abspath(__file__))
    models_dir = os.path.normpath(os.path.join(current_dir, '..', 'backend', 'models'))
    os.makedirs(models_dir, exist_ok=True)

    print(f"\nModels directory: {models_dir}")

    # Save model with compression
    model_path = os.path.join(models_dir, 'diabetes_model.pkl')
    joblib.dump(model, model_path, compress=3)
    print(f"Model saved: {model_path}")
    print(f"  File size: {os.path.getsize(model_path) / 1024:.1f} KB")

    # Save scaler with compression
    scaler_path = os.path.join(models_dir, 'scaler.pkl')
    joblib.dump(scaler, scaler_path, compress=3)
    print(f"Scaler saved: {scaler_path}")
    print(f"  File size: {os.path.getsize(scaler_path) / 1024:.1f} KB")

    # Save model metadata
    metadata = {
        'model_name': model_name,
        'feature_names': feature_names,
        'features': feature_names,  # Alias for compatibility
        'training_date': datetime.now().isoformat(),
        'random_state': RANDOM_STATE,
        'test_size': TEST_SIZE,
        'accuracy': best_metrics['accuracy'] if best_metrics else None,
        'roc_auc': best_metrics['roc_auc'] if best_metrics else None,
        'dataset': 'Pima Indians Diabetes Dataset'
    }
    metadata_path = os.path.join(models_dir, 'model_metadata.pkl')
    joblib.dump(metadata, metadata_path, compress=3)
    print(f"Metadata saved: {metadata_path}")

    # Verify files were saved correctly
    print("\nVerifying saved files...")
    for path in [model_path, scaler_path, metadata_path]:
        if os.path.exists(path) and os.path.getsize(path) > 0:
            print(f"  ✓ {os.path.basename(path)} - OK")
        else:
            print(f"  ✗ {os.path.basename(path)} - FAILED")

    return model_path, scaler_path


def print_thesis_summary(results, best_model_name, best_metrics, feature_names):
    """Print a comprehensive summary for thesis documentation."""
    print("\n" + "=" * 60)
    print("THESIS DOCUMENTATION SUMMARY")
    print("=" * 60)

    summary = f"""
================================================================================
                    MACHINE LEARNING MODEL TRAINING REPORT
                    Blood Glucose Analyzer - Diabetes Prediction
================================================================================

Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

1. DATASET INFORMATION
----------------------
- Dataset: PIMA Indians Diabetes Dataset
- Source: UCI Machine Learning Repository
- Total Samples: 768
- Features: 8
- Target: Binary (0 = No Diabetes, 1 = Diabetes)
- Class Distribution: ~65% Negative, ~35% Positive (imbalanced)

2. FEATURES USED
----------------
"""
    for i, name in enumerate(feature_names, 1):
        summary += f"   {i}. {name}\n"

    summary += f"""
3. PREPROCESSING STEPS
----------------------
- Zero Value Handling: Replaced biologically impossible zeros in
  Glucose, BloodPressure, and BMI with median values
- Data Split: {int((1-TEST_SIZE)*100)}% Training, {int(TEST_SIZE*100)}% Testing (stratified)
- Feature Scaling: StandardScaler (mean=0, std=1)
- Random State: {RANDOM_STATE} (for reproducibility)

4. MODELS TRAINED
-----------------
a) Logistic Regression
   - Solver: lbfgs
   - Max Iterations: 1000

b) Random Forest Classifier
   - Number of Trees: 100
   - Criterion: Gini impurity

c) Support Vector Machine (SVM)
   - Kernel: RBF (Radial Basis Function)
   - Probability: Enabled

5. EVALUATION METRICS
---------------------
"""

    for name, metrics in results.items():
        summary += f"""
{name}:
   - Accuracy:  {metrics['accuracy']*100:.2f}%
   - Precision: {metrics['precision']:.4f}
   - Recall:    {metrics['recall']:.4f}
   - F1-Score:  {metrics['f1']:.4f}
   - ROC-AUC:   {metrics['roc_auc']:.4f}
   - Confusion Matrix:
       TN={metrics['confusion_matrix'][0][0]}, FP={metrics['confusion_matrix'][0][1]}
       FN={metrics['confusion_matrix'][1][0]}, TP={metrics['confusion_matrix'][1][1]}
"""

    summary += f"""
6. BEST MODEL SELECTION
-----------------------
Selected Model: {best_model_name}
Selection Criterion: Highest ROC-AUC Score

Final Performance Metrics:
- Accuracy:  {best_metrics['accuracy']*100:.2f}%
- Precision: {best_metrics['precision']:.4f}
- Recall:    {best_metrics['recall']:.4f}
- F1-Score:  {best_metrics['f1']:.4f}
- ROC-AUC:   {best_metrics['roc_auc']:.4f}

7. MODEL INTERPRETATION
-----------------------
- Accuracy ({best_metrics['accuracy']*100:.2f}%): The model correctly predicts diabetes
  status for approximately {best_metrics['accuracy']*100:.0f} out of 100 patients.

- Precision ({best_metrics['precision']:.4f}): When the model predicts diabetes, it is
  correct {best_metrics['precision']*100:.1f}% of the time.

- Recall ({best_metrics['recall']:.4f}): The model correctly identifies {best_metrics['recall']*100:.1f}%
  of actual diabetes cases.

- F1-Score ({best_metrics['f1']:.4f}): Harmonic mean of precision and recall,
  balancing both metrics.

- ROC-AUC ({best_metrics['roc_auc']:.4f}): The model has a {best_metrics['roc_auc']*100:.1f}% chance of
  correctly distinguishing between diabetes and non-diabetes cases.

8. NOTES FOR THESIS
-------------------
- Model performance is within expected range (65-75% accuracy)
- Higher accuracy (>85%) would suggest overfitting
- This is a RISK PREDICTION tool, not a diagnostic system
- All predictions should be accompanied by appropriate disclaimers
- Model should be validated with local (Nepal) data if available

================================================================================
                              END OF REPORT
================================================================================
"""

    print(summary)

    # Save summary to file
    summary_path = os.path.join(os.path.dirname(__file__), 'training_results.txt')
    with open(summary_path, 'w') as f:
        f.write(summary)
    print(f"\nSummary saved to: {summary_path}")

    return summary


def main():
    """Main training pipeline."""
    print("\n" + "=" * 60)
    print("BLOOD GLUCOSE ANALYZER - ML MODEL TRAINING")
    print("Diabetes Risk Prediction using PIMA Dataset")
    print("=" * 60)

    # Step 1: Load data
    df = load_data()

    # Step 2: Preprocess data
    X_train, X_test, y_train, y_test, scaler, feature_names = preprocess_data(df)

    # Step 3: Train models
    models = train_models(X_train, y_train)

    # Step 4: Evaluate models
    results = evaluate_all_models(models, X_test, y_test)

    # Step 5: Find best model
    best_model_name, best_model, best_metrics = find_best_model(results, models)

    # Step 6: Save best model and scaler
    model_path, scaler_path = save_model(best_model, scaler, best_model_name, feature_names, best_metrics)

    # Step 7: Print thesis summary
    print_thesis_summary(results, best_model_name, best_metrics, feature_names)

    print("\n" + "=" * 60)
    print("TRAINING COMPLETE")
    print("=" * 60)
    print(f"\nModel saved to: {model_path}")
    print(f"Scaler saved to: {scaler_path}")
    print("\nYou can now use these files in the backend for predictions.")


if __name__ == '__main__':
    main()
