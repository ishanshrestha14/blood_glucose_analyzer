# Blood Glucose Analyzer — CLAUDE.md

Undergraduate CS thesis project. AI-powered glucose report analysis and diabetes risk prediction. Focus: healthcare accessibility in Nepal.

## Project Structure

```
blood_glucose_analyzer/
├── backend/               Flask API (port 5000)
│   ├── app.py             18 endpoints, Swagger at /api/docs
│   ├── config.py
│   ├── requirements.txt
│   ├── services/
│   │   ├── ocr_service.py          PaddleOCR + OpenCV preprocessing
│   │   ├── classification_service.py  ADA guideline classification
│   │   ├── validation_service.py   Report type validation
│   │   ├── ml_predictor.py         Random Forest risk prediction
│   │   ├── explainability_service.py  SHAP explanations
│   │   ├── database_service.py     SQLite history
│   │   └── pdf_service.py          ReportLab PDF generation
│   └── models/            Trained .pkl artifacts
├── frontend/              React 19 + TypeScript + Tailwind CSS 4 (port 5173)
│   └── src/
│       ├── components/
│       ├── pages/         Home, Analyze, History, About
│       ├── services/api.ts
│       └── types/index.ts
├── ml_training/           PIMA dataset + training script
├── Dockerfile             Backend image (build context = repo root)
├── .github/workflows/     CI: tests.yml
└── docs/
    └── CASE_STUDY.md
```

## Dev Setup

```bash
# Backend
cd backend && source venv/bin/activate && python3 app.py

# Frontend
cd frontend && npm run dev

# Docker (backend only)
docker build -t glucose-analyzer . && docker run -p 5000:5000 glucose-analyzer
```

## Tests

`diabetes_pipeline.pkl` is gitignored — run `python ml_training/train_model.py` first on a fresh clone.
Both test dirs are packages named `tests`, so run them separately:

```bash
cd backend && python -m pytest tests
cd ml_training && python -m pytest tests
```

CI (`.github/workflows/tests.yml`) runs both on push to `main` and on PRs. It skips PaddleOCR install and trains the model before testing.

## Enhancement Roadmap

Tackling these one by one in order:

- [x] **1. OCR preprocessing + structured parsing** — OpenCV pipeline (deskew, CLAHE, adaptive threshold), relative y-threshold row grouping, reference range rejection, one-row lookahead. Returns `extracted_fields` dict with confidence metadata.
- [x] **1b. Confidence-aware OCR UX** — `OcrFieldsEditor` component shows detected fields as editable inputs with green/amber confidence badges. Low confidence (<75%) gets amber border + warning. "Confirm & Re-analyze" re-runs ADA classification.
- [x] **2. PIMA data cleaning + retraining + calibration** — Zero-imputation for physiologically impossible values, feature engineering, class balancing, `CalibratedClassifierCV`, retrain and swap `.pkl`.
- [x] **3. SHAP + human-readable explanations** — SHAP waterfall chart per prediction, plain-English factor summaries, improve `explainability_service.py`.
- [x] **5. Basic trends + insight sentence** — Date range filter on History page, auto-generated insight sentence (e.g. "Your FBS has trended down over 30 days").
- [x] **6. UI polish** — Mobile responsiveness audit, skeleton loaders, better empty/error states.
- [ ] **7. i18n (partial)** — `react-i18next`, Nepali (ne) + Hindi (hi) + English (en), translate UI labels and classification results.

## Key Conventions

- Python: PEP 8, no `any` types
- TypeScript: strict typing, no `any`
- React: functional components + hooks only
- No auth required — educational tool, local processing only
- Uploaded images are deleted after OCR processing
- All endpoints documented in Swagger — keep Flasgger docstrings updated when adding/changing endpoints
- `LOW_CONFIDENCE_THRESHOLD = 0.75` in `ocr_service.py`

## Stack

| Layer | Tech |
|-------|------|
| Frontend | React 19, TypeScript 5.9, Vite 7, Tailwind CSS 4, Recharts, Lucide React, Axios |
| Backend | Flask, Flask-CORS, Flasgger |
| OCR | PaddleOCR + OpenCV (opencv-python-headless) |
| ML | scikit-learn Random Forest, SHAP TreeExplainer |
| DB | SQLite |
| PDF | ReportLab |

## ML Model

- Dataset: PIMA Indians Diabetes (768 samples, 8 features)
- Algorithm: Random Forest (100 trees)
- Current accuracy: ~74%, ROC-AUC ~80%
- Known issue: columns with `0` values (Glucose, BloodPressure, BMI, Insulin, SkinThickness) are actually missing data — not yet imputed
- Model artifacts: `backend/models/`

## Deployment Target

- Backend: Docker → Railway/Render (`Dockerfile` at repo root — set build context to the repo root, not `backend/`). The build retrains the model from the PIMA CSV; gunicorn binds to `$PORT` (default 5000).
- Frontend: Vercel (`frontend/vercel.json`), root dir = `frontend`
- Note: PaddleOCR adds ~500MB to image. On free-tier, remove paddlepaddle/paddleocr — manual input + risk prediction still work.
