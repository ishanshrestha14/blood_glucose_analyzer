"""
Blood Glucose Analyzer API

Flask backend that provides:
- Image upload and OCR extraction
- Report validation
- Glucose classification based on ADA guidelines
- Diabetes risk prediction using ML model
"""

import os
import uuid
from datetime import datetime
from flask import Flask, jsonify, request, Response
from flask_cors import CORS
from werkzeug.utils import secure_filename
try:
    from flasgger import Swagger
    _SWAGGER_AVAILABLE = True
except ImportError:
    _SWAGGER_AVAILABLE = False
    Swagger = None

# Import configuration
from config import Config

# Import services
from services.ocr_service import get_ocr_service, extract_glucose_values
from services.classification_service import (
    classify_glucose,
    classify_multiple,
    get_all_thresholds,
    get_recommendation
)
from services.validation_service import (
    validate_glucose_report,
    detect_report_type,
    comprehensive_validation,
    get_supported_report_types
)
from services.ml_predictor import (
    predict_diabetes_risk,
    predict_diabetes_risk_with_explanation,
    get_prediction_thresholds,
    get_input_requirements,
    check_model_status,
    get_feature_importance
)
from services.database_service import get_database_service
from services.pdf_service import get_pdf_service


# Initialize Flask app
app = Flask(__name__)
app.config.from_object(Config)

# Enable CORS for all routes
CORS(app, resources={r"/*": {"origins": Config.CORS_ORIGINS}})

# Initialize Swagger / Flasgger
swagger_template = {
    "swagger": "2.0",
    "info": {
        "title": "Blood Glucose Analyzer API",
        "description": (
            "AI-powered API for analyzing blood glucose reports and predicting diabetes risk.\n\n"
            "**Features:**\n"
            "- OCR extraction from lab report images (PaddleOCR)\n"
            "- ADA guideline-based glucose classification\n"
            "- ML diabetes risk prediction with SHAP explanations\n"
            "- Analysis history and trend tracking\n"
            "- PDF report generation"
        ),
        "version": "1.0.0",
        "contact": {"name": "Ishan"},
    },
    "basePath": "/",
    "schemes": ["http", "https"],
    "tags": [
        {"name": "Health", "description": "Service health and status checks"},
        {"name": "Analysis", "description": "Image upload and OCR-based analysis"},
        {"name": "Classification", "description": "Manual glucose value classification"},
        {"name": "Risk Prediction", "description": "ML-based diabetes risk prediction"},
        {"name": "Reference", "description": "Thresholds and supported test types"},
        {"name": "History", "description": "Analysis history and trend data"},
        {"name": "Reports", "description": "PDF report generation"},
    ],
}
swagger_config = {
    "headers": [],
    "specs": [
        {
            "endpoint": "apispec",
            "route": "/apispec.json",
            "rule_filter": lambda rule: True,
            "model_filter": lambda tag: True,
        }
    ],
    "static_url_path": "/flasgger_static",
    "swagger_ui": True,
    "specs_route": "/api/docs/",
}
if _SWAGGER_AVAILABLE and Swagger:
    Swagger(app, template=swagger_template, config=swagger_config)

# Ensure upload folder exists
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)


def allowed_file(filename):
    """Check if file extension is allowed."""
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in Config.ALLOWED_EXTENSIONS


def generate_unique_filename(original_filename):
    """Generate a unique filename to prevent overwrites."""
    ext = original_filename.rsplit('.', 1)[1].lower() if '.' in original_filename else 'png'
    unique_name = f"{uuid.uuid4().hex}_{datetime.now().strftime('%Y%m%d%H%M%S')}.{ext}"
    return unique_name


def cleanup_file(filepath):
    """Remove a file if it exists."""
    try:
        if filepath and os.path.exists(filepath):
            os.remove(filepath)
    except Exception as e:
        app.logger.warning(f"Failed to cleanup file {filepath}: {e}")


# ============================================
# Health Check Endpoints
# ============================================

@app.route('/')
def index():
    """Basic health check
    ---
    tags:
      - Health
    summary: Basic health check
    description: Returns API status, name, and version.
    responses:
      200:
        description: API is running
        schema:
          type: object
          properties:
            status:
              type: string
              example: running
            message:
              type: string
              example: Blood Glucose Analyzer API
            version:
              type: string
              example: 1.0.0
    """
    return jsonify({
        "status": "running",
        "message": "Blood Glucose Analyzer API",
        "version": "1.0.0"
    })


@app.route('/api/health')
def health_check():
    """Detailed system health check
    ---
    tags:
      - Health
    summary: Detailed system health check
    description: Checks OCR service, ML model, and uploads folder status.
    responses:
      200:
        description: Health status report
        schema:
          type: object
          properties:
            status:
              type: string
              enum: [healthy, degraded]
            timestamp:
              type: string
              format: date-time
            services:
              type: object
              properties:
                ocr:
                  type: object
                  properties:
                    initialized:
                      type: boolean
                ml_model:
                  type: object
                  properties:
                    initialized:
                      type: boolean
                uploads:
                  type: object
                  properties:
                    exists:
                      type: boolean
                    writable:
                      type: boolean
      500:
        description: Health check error
    """
    try:
        # Check OCR service
        ocr_service = get_ocr_service()
        ocr_status = {
            "initialized": ocr_service.initialized,
            "error": ocr_service.init_error if not ocr_service.initialized else None
        }

        # Check ML model
        ml_status = check_model_status()

        # Check uploads folder
        uploads_folder = app.config['UPLOAD_FOLDER']
        uploads_status = {
            "exists": os.path.exists(uploads_folder),
            "writable": os.access(uploads_folder, os.W_OK) if os.path.exists(uploads_folder) else False
        }

        # Determine overall status
        all_healthy = (
            ocr_status['initialized'] and
            ml_status.get('initialized', False) and
            uploads_status['exists'] and
            uploads_status['writable']
        )

        return jsonify({
            "status": "healthy" if all_healthy else "degraded",
            "timestamp": datetime.now().isoformat(),
            "services": {
                "ocr": ocr_status,
                "ml_model": {
                    "initialized": ml_status.get('initialized', False),
                    "model_info": ml_status.get('model_info'),
                    "error": ml_status.get('error')
                },
                "uploads": uploads_status
            }
        })

    except Exception as e:
        app.logger.error(f"Health check error: {e}")
        return jsonify({
            "status": "error",
            "error": str(e)
        }), 500


# ============================================
# File Upload Endpoint
# ============================================

@app.route('/api/upload', methods=['POST'])
def upload_file():
    """Upload an image file
    ---
    tags:
      - Analysis
    summary: Upload an image file
    description: Uploads a lab report image and returns the saved filename.
    consumes:
      - multipart/form-data
    parameters:
      - name: file
        in: formData
        type: file
        required: true
        description: Lab report image (PNG, JPG, JPEG, GIF, BMP). Max 16MB.
    responses:
      200:
        description: File uploaded successfully
        schema:
          type: object
          properties:
            success:
              type: boolean
              example: true
            filename:
              type: string
            original_filename:
              type: string
      400:
        description: Missing file or invalid file type
      500:
        description: Server error
    """
    try:
        if 'file' not in request.files:
            return jsonify({
                "success": False,
                "error": "No file part in request"
            }), 400

        file = request.files['file']

        if file.filename == '':
            return jsonify({
                "success": False,
                "error": "No file selected"
            }), 400

        if not allowed_file(file.filename):
            return jsonify({
                "success": False,
                "error": f"File type not allowed. Allowed types: {', '.join(Config.ALLOWED_EXTENSIONS)}"
            }), 400

        # Generate unique filename
        original_filename = secure_filename(file.filename)
        filename = generate_unique_filename(original_filename)
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)

        # Save file
        file.save(filepath)

        return jsonify({
            "success": True,
            "message": "File uploaded successfully",
            "filename": filename,
            "original_filename": original_filename,
            "filepath": filepath
        })

    except Exception as e:
        app.logger.error(f"Upload error: {e}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


# ============================================
# Analyze Endpoint (OCR + Validation + Classification)
# ============================================

@app.route('/api/analyze', methods=['POST'])
def analyze_report():
    """Analyze a lab report image (OCR + classification)
    ---
    tags:
      - Analysis
    summary: Analyze a lab report image
    description: |
      Full analysis pipeline:
      1. Save uploaded image
      2. Extract text using PaddleOCR
      3. Validate as a glucose report
      4. Extract and classify glucose values per ADA guidelines
    consumes:
      - multipart/form-data
    parameters:
      - name: file
        in: formData
        type: file
        required: true
        description: Lab report image (PNG, JPG, JPEG, GIF, BMP). Max 16MB.
    responses:
      200:
        description: Analysis result
        schema:
          type: object
          properties:
            success:
              type: boolean
            is_valid_report:
              type: boolean
            extracted_text:
              type: string
            detected_values:
              type: array
              items:
                type: object
                properties:
                  test_type:
                    type: string
                  value:
                    type: number
                  unit:
                    type: string
            classifications:
              type: array
              items:
                type: object
            summary:
              type: string
            analysis_timestamp:
              type: string
              format: date-time
      400:
        description: No file provided, invalid type, or OCR extraction failed
      500:
        description: Server error
    """
    filepath = None

    try:
        # Check for file in request
        if 'file' not in request.files:
            return jsonify({
                "success": False,
                "error": "No file part in request"
            }), 400

        file = request.files['file']

        if file.filename == '':
            return jsonify({
                "success": False,
                "error": "No file selected"
            }), 400

        if not allowed_file(file.filename):
            return jsonify({
                "success": False,
                "error": f"File type not allowed. Allowed types: {', '.join(Config.ALLOWED_EXTENSIONS)}"
            }), 400

        # Save file temporarily
        original_filename = secure_filename(file.filename)
        filename = generate_unique_filename(original_filename)
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(filepath)

        # Step 1: Extract text and glucose values using OCR
        ocr_result = extract_glucose_values(filepath)

        if not ocr_result.get('extraction_success', False):
            cleanup_file(filepath)
            return jsonify({
                "success": False,
                "error": ocr_result.get('error', 'OCR extraction failed'),
                "message": "Failed to extract text from the image. Please ensure the image is clear and readable."
            }), 400

        extracted_text = ocr_result.get('raw_text', '')

        # Step 2: Validate as glucose report
        validation_result = comprehensive_validation(extracted_text)

        if not validation_result['is_valid']:
            cleanup_file(filepath)
            return jsonify({
                "success": False,
                "is_valid_report": False,
                "validation": validation_result,
                "extracted_text": extracted_text,
                "message": validation_result.get('message', 'This does not appear to be a glucose report.')
            })

        # Step 3: Get detected glucose values from OCR
        detected_values = ocr_result.get('detected_values', [])
        extracted_fields = ocr_result.get('extracted_fields', {})

        if not detected_values:
            cleanup_file(filepath)
            return jsonify({
                "success": True,
                "is_valid_report": True,
                "validation": validation_result,
                "extracted_text": extracted_text,
                "detected_values": [],
                "classifications": [],
                "message": "Report validated as glucose report, but no specific glucose values could be extracted. "
                          "The image may need to be clearer, or you can enter values manually."
            })

        # Step 4: Classify each detected glucose value
        classifications = []
        for value_info in detected_values:
            classification = classify_glucose(
                test_type=value_info['test_type'],
                value=value_info['value'],
                unit=value_info['unit']
            )

            if classification.get('success'):
                classifications.append({
                    "detected": value_info,
                    "classification": classification
                })

        # Step 5: Generate summary
        if classifications:
            # Check for concerning results
            severity_levels = [c['classification'].get('severity', 'low') for c in classifications]

            if 'high' in severity_levels:
                summary = "Analysis complete. Some values are in the diabetes range. Please consult a healthcare provider."
            elif 'moderate' in severity_levels:
                summary = "Analysis complete. Some values indicate prediabetes or need monitoring. Consider consulting a healthcare provider."
            else:
                summary = "Analysis complete. Values appear to be within normal range."
        else:
            summary = "Analysis complete. No classifiable glucose values found."

        # Cleanup temporary file
        cleanup_file(filepath)

        return jsonify({
            "success": True,
            "is_valid_report": True,
            "validation": validation_result,
            "extracted_text": extracted_text,
            "detected_values": detected_values,
            "extracted_fields": extracted_fields,
            "classifications": classifications,
            "summary": summary,
            "analysis_timestamp": datetime.now().isoformat()
        })

    except Exception as e:
        app.logger.error(f"Analysis error: {e}")
        cleanup_file(filepath)
        return jsonify({
            "success": False,
            "error": str(e),
            "message": "An error occurred during analysis. Please try again."
        }), 500


# ============================================
# Manual Input Endpoint
# ============================================

@app.route('/api/manual-input', methods=['POST'])
def manual_input():
    """Classify a single glucose value
    ---
    tags:
      - Classification
    summary: Classify a single glucose value
    description: Classifies a manually entered glucose value using ADA guidelines.
    consumes:
      - application/json
    parameters:
      - in: body
        name: body
        required: true
        schema:
          type: object
          required:
            - test_type
            - value
          properties:
            test_type:
              type: string
              enum: [fasting, hba1c, ppbs, rbs, ogtt]
              example: fasting
            value:
              type: number
              example: 105
            unit:
              type: string
              default: mg/dL
              example: mg/dL
    responses:
      200:
        description: Classification result
        schema:
          type: object
          properties:
            success:
              type: boolean
            input:
              type: object
            classification:
              type: object
              properties:
                classification:
                  type: string
                  enum: [Normal, Low, Prediabetes, Needs Monitoring, Diabetes]
                severity:
                  type: string
                value:
                  type: number
                unit:
                  type: string
                recommendation:
                  type: string
      400:
        description: Missing fields or invalid value
      500:
        description: Server error
    """
    try:
        data = request.get_json()

        if not data:
            return jsonify({
                "success": False,
                "error": "No JSON data provided"
            }), 400

        # Validate required fields
        required_fields = ['test_type', 'value']
        missing_fields = [field for field in required_fields if field not in data]

        if missing_fields:
            return jsonify({
                "success": False,
                "error": f"Missing required fields: {', '.join(missing_fields)}"
            }), 400

        # Get values with defaults
        test_type = data['test_type']
        value = data['value']
        unit = data.get('unit', 'mg/dL')

        # Validate value is a number
        try:
            value = float(value)
        except (TypeError, ValueError):
            return jsonify({
                "success": False,
                "error": "Value must be a valid number"
            }), 400

        # Run classification
        result = classify_glucose(test_type, value, unit)

        if not result.get('success'):
            return jsonify({
                "success": False,
                "error": result.get('error', 'Classification failed')
            }), 400

        return jsonify({
            "success": True,
            "input": {
                "test_type": test_type,
                "value": value,
                "unit": unit
            },
            "classification": result
        })

    except Exception as e:
        app.logger.error(f"Manual input error: {e}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


@app.route('/api/manual-input/batch', methods=['POST'])
def manual_input_batch():
    """Classify multiple glucose values in one request
    ---
    tags:
      - Classification
    summary: Batch classify glucose values
    description: Classifies multiple glucose readings in a single request.
    consumes:
      - application/json
    parameters:
      - in: body
        name: body
        required: true
        schema:
          type: object
          required:
            - readings
          properties:
            readings:
              type: array
              items:
                type: object
                required:
                  - test_type
                  - value
                properties:
                  test_type:
                    type: string
                    enum: [fasting, hba1c, ppbs, rbs, ogtt]
                  value:
                    type: number
                  unit:
                    type: string
                    default: mg/dL
              example:
                - test_type: fasting
                  value: 105
                  unit: mg/dL
                - test_type: hba1c
                  value: 6.2
                  unit: "%"
    responses:
      200:
        description: Batch classification results
        schema:
          type: object
          properties:
            success:
              type: boolean
            input_count:
              type: integer
      400:
        description: Missing or empty readings array
      500:
        description: Server error
    """
    try:
        data = request.get_json()

        if not data or 'readings' not in data:
            return jsonify({
                "success": False,
                "error": "No readings provided. Expected: {\"readings\": [...]}"
            }), 400

        readings = data['readings']

        if not isinstance(readings, list) or len(readings) == 0:
            return jsonify({
                "success": False,
                "error": "Readings must be a non-empty array"
            }), 400

        # Classify all readings
        result = classify_multiple(readings)

        return jsonify({
            "success": True,
            "input_count": len(readings),
            **result
        })

    except Exception as e:
        app.logger.error(f"Batch input error: {e}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


# ============================================
# Risk Prediction Endpoint
# ============================================

@app.route('/api/predict-risk', methods=['POST'])
def predict_risk():
    """Predict diabetes risk
    ---
    tags:
      - Risk Prediction
    summary: Predict diabetes risk using ML model
    description: |
      Uses a Random Forest model trained on the PIMA Indians Diabetes Dataset
      to predict diabetes risk. Returns risk percentage and category
      (Low / Moderate / High).
    consumes:
      - application/json
    parameters:
      - in: body
        name: body
        required: true
        schema:
          type: object
          required:
            - glucose
            - bmi
            - age
            - blood_pressure
          properties:
            glucose:
              type: number
              description: Plasma glucose concentration (mg/dL)
              example: 105
            bmi:
              type: number
              description: Body mass index (kg/m^2)
              example: 25.5
            age:
              type: integer
              description: Age in years
              example: 45
            blood_pressure:
              type: number
              description: Diastolic blood pressure (mm Hg)
              example: 80
            insulin:
              type: number
              description: 2-hour serum insulin (mu U/ml, optional)
              example: 100
            skin_thickness:
              type: number
              description: Triceps skin fold thickness (mm, optional)
              example: 20
            pregnancies:
              type: integer
              description: Number of pregnancies (optional)
              example: 2
            diabetes_pedigree:
              type: number
              description: Diabetes pedigree function (optional)
              example: 0.5
    responses:
      200:
        description: Risk prediction result
        schema:
          type: object
          properties:
            success:
              type: boolean
            risk_percentage:
              type: number
              example: 67
            risk_category:
              type: string
              enum: [Low, Moderate, High]
      400:
        description: Validation error
      500:
        description: Server error
    """
    try:
        data = request.get_json()

        if not data:
            return jsonify({
                "success": False,
                "error": "No JSON data provided"
            }), 400

        # Run prediction (validation handled by service)
        result = predict_diabetes_risk(data)

        if not result.get('success'):
            return jsonify(result), 400

        return jsonify(result)

    except Exception as e:
        app.logger.error(f"Prediction error: {e}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


@app.route('/api/predict-risk/requirements', methods=['GET'])
def prediction_requirements():
    """Get input requirements for risk prediction
    ---
    tags:
      - Risk Prediction
    summary: Get prediction input requirements
    description: Returns required and optional input fields with their ranges and descriptions.
    responses:
      200:
        description: Input requirements
        schema:
          type: object
          properties:
            success:
              type: boolean
      500:
        description: Server error
    """
    try:
        return jsonify({
            "success": True,
            **get_input_requirements()
        })
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


@app.route('/api/predict-risk/thresholds', methods=['GET'])
def prediction_thresholds():
    """Get risk category thresholds
    ---
    tags:
      - Risk Prediction
    summary: Get risk category thresholds
    description: Returns the percentage boundaries for Low, Moderate, and High risk categories.
    responses:
      200:
        description: Risk thresholds
        schema:
          type: object
          properties:
            success:
              type: boolean
      500:
        description: Server error
    """
    try:
        return jsonify({
            "success": True,
            **get_prediction_thresholds()
        })
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


@app.route('/api/predict-risk/feature-importance', methods=['GET'])
def feature_importance():
    """Get feature importance from the ML model
    ---
    tags:
      - Risk Prediction
    summary: Get feature importance
    description: Returns the feature importance scores from the trained Random Forest model.
    responses:
      200:
        description: Feature importance data
      500:
        description: Server error
    """
    try:
        result = get_feature_importance()
        return jsonify(result)
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


@app.route('/api/predict-risk/explain', methods=['POST'])
def predict_risk_with_explanation():
    """Predict diabetes risk with SHAP explanation
    ---
    tags:
      - Risk Prediction
    summary: Predict risk with SHAP explanation
    description: |
      Same input as /api/predict-risk but additionally returns:
      - SHAP feature contributions with plain-English summaries
      - Confidence interval from Random Forest tree variance
    consumes:
      - application/json
    parameters:
      - in: body
        name: body
        required: true
        schema:
          type: object
          required:
            - glucose
            - bmi
            - age
            - blood_pressure
          properties:
            glucose:
              type: number
              example: 105
            bmi:
              type: number
              example: 25.5
            age:
              type: integer
              example: 45
            blood_pressure:
              type: number
              example: 80
            insulin:
              type: number
            skin_thickness:
              type: number
            pregnancies:
              type: integer
            diabetes_pedigree:
              type: number
    responses:
      200:
        description: Prediction with explanation
        schema:
          type: object
          properties:
            success:
              type: boolean
            risk_percentage:
              type: number
            risk_category:
              type: string
            explanation:
              type: object
              description: SHAP feature contributions
            confidence_interval:
              type: object
              properties:
                lower:
                  type: number
                upper:
                  type: number
      400:
        description: Validation error
      500:
        description: Server error
    """
    try:
        data = request.get_json()

        if not data:
            return jsonify({
                "success": False,
                "error": "No JSON data provided"
            }), 400

        result = predict_diabetes_risk_with_explanation(data)

        if not result.get('success'):
            return jsonify(result), 400

        return jsonify(result)

    except Exception as e:
        app.logger.error(f"Explanation error: {e}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


# ============================================
# Reference Data Endpoints
# ============================================

@app.route('/api/thresholds', methods=['GET'])
def thresholds():
    """Get glucose classification thresholds
    ---
    tags:
      - Reference
    summary: Get ADA classification thresholds
    description: Returns classification thresholds for all supported glucose test types (fasting, hba1c, ppbs, rbs, ogtt).
    responses:
      200:
        description: Threshold data for each test type
        schema:
          type: object
          properties:
            success:
              type: boolean
      500:
        description: Server error
    """
    try:
        result = get_all_thresholds()
        return jsonify({
            "success": True,
            **result
        })
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


@app.route('/api/supported-tests', methods=['GET'])
def supported_tests():
    """Get supported glucose test types
    ---
    tags:
      - Reference
    summary: Get supported test types
    description: Returns the list of glucose test types the system can classify (fasting, hba1c, ppbs, rbs, ogtt).
    responses:
      200:
        description: Supported test types
        schema:
          type: object
          properties:
            success:
              type: boolean
      500:
        description: Server error
    """
    try:
        result = get_supported_report_types()
        return jsonify({
            "success": True,
            **result
        })
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


# ============================================
# History & Persistence Endpoints
# ============================================

@app.route('/api/save-analysis', methods=['POST'])
def save_analysis():
    """Save an analysis result to history
    ---
    tags:
      - History
    summary: Save analysis to history
    description: Persists an analysis result (OCR, manual, or risk) to the database.
    consumes:
      - application/json
    parameters:
      - in: body
        name: body
        required: true
        schema:
          type: object
          required:
            - analysis_type
          properties:
            analysis_type:
              type: string
              enum: [ocr, manual, risk]
              example: manual
            input_data:
              type: object
            result_data:
              type: object
            test_type:
              type: string
            glucose_value:
              type: number
            classification:
              type: string
            risk_category:
              type: string
            risk_percentage:
              type: number
            label:
              type: string
    responses:
      201:
        description: Analysis saved
        schema:
          type: object
          properties:
            success:
              type: boolean
            id:
              type: string
            created_at:
              type: string
              format: date-time
      400:
        description: Invalid analysis_type
      500:
        description: Server error
    """
    try:
        data = request.get_json()
        if not data:
            return jsonify({"success": False, "error": "No JSON data provided"}), 400

        analysis_type = data.get('analysis_type')
        if analysis_type not in ('ocr', 'manual', 'risk'):
            return jsonify({
                "success": False,
                "error": "analysis_type must be 'ocr', 'manual', or 'risk'"
            }), 400

        db = get_database_service()
        result = db.save_analysis(
            analysis_type=analysis_type,
            input_data=data.get('input_data'),
            result_data=data.get('result_data'),
            test_type=data.get('test_type'),
            glucose_value=data.get('glucose_value'),
            classification=data.get('classification'),
            risk_category=data.get('risk_category'),
            risk_percentage=data.get('risk_percentage'),
            label=data.get('label'),
        )

        if not result.get('success'):
            return jsonify(result), 500

        return jsonify(result), 201

    except Exception as e:
        app.logger.error(f"Save analysis error: {e}")
        return jsonify({"success": False, "error": str(e)}), 500


@app.route('/api/history', methods=['GET'])
def get_history():
    """Get analysis history
    ---
    tags:
      - History
    summary: Get analysis history with pagination
    description: Returns a paginated list of saved analyses, optionally filtered by type.
    parameters:
      - name: limit
        in: query
        type: integer
        default: 50
        description: Maximum number of results
      - name: offset
        in: query
        type: integer
        default: 0
        description: Number of results to skip
      - name: type
        in: query
        type: string
        enum: [ocr, manual, risk]
        description: Filter by analysis type
    responses:
      200:
        description: Paginated history
        schema:
          type: object
          properties:
            success:
              type: boolean
            analyses:
              type: array
              items:
                type: object
            total:
              type: integer
            limit:
              type: integer
            offset:
              type: integer
      500:
        description: Server error
    """
    try:
        limit = request.args.get('limit', 50, type=int)
        offset = request.args.get('offset', 0, type=int)
        analysis_type = request.args.get('type', None)

        db = get_database_service()
        result = db.get_history(limit=limit, offset=offset, analysis_type=analysis_type)
        return jsonify(result)

    except Exception as e:
        app.logger.error(f"Get history error: {e}")
        return jsonify({"success": False, "error": str(e)}), 500


@app.route('/api/history/<analysis_id>', methods=['GET'])
def get_analysis_detail(analysis_id):
    """Get a single analysis by ID
    ---
    tags:
      - History
    summary: Get analysis detail
    description: Returns full details of a single saved analysis.
    parameters:
      - name: analysis_id
        in: path
        type: string
        required: true
        description: Analysis UUID
    responses:
      200:
        description: Analysis detail
      404:
        description: Analysis not found
      500:
        description: Server error
    """
    try:
        db = get_database_service()
        result = db.get_analysis(analysis_id)

        if not result.get('success'):
            return jsonify(result), 404

        return jsonify(result)

    except Exception as e:
        app.logger.error(f"Get analysis error: {e}")
        return jsonify({"success": False, "error": str(e)}), 500


@app.route('/api/history/<analysis_id>', methods=['DELETE'])
def delete_analysis(analysis_id):
    """Delete an analysis from history
    ---
    tags:
      - History
    summary: Delete an analysis
    description: Permanently removes an analysis from history.
    parameters:
      - name: analysis_id
        in: path
        type: string
        required: true
        description: Analysis UUID
    responses:
      200:
        description: Analysis deleted
      404:
        description: Analysis not found
      500:
        description: Server error
    """
    try:
        db = get_database_service()
        result = db.delete_analysis(analysis_id)

        if not result.get('success'):
            return jsonify(result), 404

        return jsonify(result)

    except Exception as e:
        app.logger.error(f"Delete analysis error: {e}")
        return jsonify({"success": False, "error": str(e)}), 500


@app.route('/api/trends', methods=['GET'])
def get_trends():
    """Get glucose trend data
    ---
    tags:
      - History
    summary: Get trend data for charts
    description: Returns glucose values over time. Use start_date/end_date for a custom range, or days for a relative lookback.
    parameters:
      - name: days
        in: query
        type: integer
        default: 30
        description: Number of days to look back (ignored when start_date and end_date are provided)
      - name: start_date
        in: query
        type: string
        description: Start date (YYYY-MM-DD)
      - name: end_date
        in: query
        type: string
        description: End date (YYYY-MM-DD)
      - name: test_type
        in: query
        type: string
        enum: [fasting, hba1c, ppbs, rbs, ogtt]
        description: Filter by test type
    responses:
      200:
        description: Trend data points
        schema:
          type: object
          properties:
            success:
              type: boolean
            data_points:
              type: array
              items:
                type: object
            count:
              type: integer
      500:
        description: Server error
    """
    try:
        days       = request.args.get('days', 30, type=int)
        start_date = request.args.get('start_date', None)
        end_date   = request.args.get('end_date', None)
        test_type  = request.args.get('test_type', None)

        db = get_database_service()
        result = db.get_trend_data(
            test_type=test_type,
            days=days,
            start_date=start_date,
            end_date=end_date,
        )
        return jsonify(result)

    except Exception as e:
        app.logger.error(f"Get trends error: {e}")
        return jsonify({"success": False, "error": str(e)}), 500


@app.route('/api/trends/insight', methods=['GET'])
def get_trend_insight():
    """Get insight sentence for the selected trend window
    ---
    tags:
      - History
    summary: Generate plain-English insight for glucose trend
    description: Returns a sentence describing glucose trajectory and most recent risk category for the selected period.
    parameters:
      - name: days
        in: query
        type: integer
        default: 30
        description: Number of days to look back (ignored when start_date and end_date are provided)
      - name: start_date
        in: query
        type: string
        description: Start date (YYYY-MM-DD)
      - name: end_date
        in: query
        type: string
        description: End date (YYYY-MM-DD)
      - name: test_type
        in: query
        type: string
        enum: [fasting, hba1c, ppbs, rbs, ogtt]
    responses:
      200:
        description: Insight result
        schema:
          type: object
          properties:
            success:
              type: boolean
            insight:
              type: object
              nullable: true
              description: null when fewer than 2 data points exist
      500:
        description: Server error
    """
    try:
        days       = request.args.get('days', 30, type=int)
        start_date = request.args.get('start_date', None)
        end_date   = request.args.get('end_date', None)
        test_type  = request.args.get('test_type', None)

        db = get_database_service()
        result = db.get_trend_insight(
            test_type=test_type,
            days=days,
            start_date=start_date,
            end_date=end_date,
        )
        return jsonify(result)

    except Exception as e:
        app.logger.error(f"Get trend insight error: {e}")
        return jsonify({"success": False, "error": str(e)}), 500


# ============================================
# PDF Report Endpoint
# ============================================

@app.route('/api/report/pdf/<analysis_id>', methods=['GET'])
def download_pdf_report(analysis_id):
    """Download PDF report
    ---
    tags:
      - Reports
    summary: Generate and download a PDF report
    description: Generates a PDF report for a previously saved analysis and returns it as a download.
    produces:
      - application/pdf
    parameters:
      - name: analysis_id
        in: path
        type: string
        required: true
        description: Analysis UUID
    responses:
      200:
        description: PDF file
        schema:
          type: file
      404:
        description: Analysis not found
      500:
        description: PDF generation error
    """
    try:
        db = get_database_service()
        result = db.get_analysis(analysis_id)

        if not result.get('success'):
            return jsonify(result), 404

        pdf_service = get_pdf_service()
        pdf_bytes = pdf_service.generate_report(result['analysis'])

        return Response(
            pdf_bytes,
            mimetype='application/pdf',
            headers={
                'Content-Disposition': f'attachment; filename=glucose-report-{analysis_id[:8]}.pdf'
            }
        )

    except Exception as e:
        app.logger.error(f"PDF generation error: {e}")
        return jsonify({"success": False, "error": str(e)}), 500


# ============================================
# Error Handlers
# ============================================

@app.errorhandler(400)
def bad_request(error):
    return jsonify({
        "success": False,
        "error": "Bad request",
        "message": str(error)
    }), 400


@app.errorhandler(404)
def not_found(error):
    return jsonify({
        "success": False,
        "error": "Endpoint not found"
    }), 404


@app.errorhandler(413)
def request_entity_too_large(error):
    return jsonify({
        "success": False,
        "error": "File too large",
        "message": f"Maximum file size is {Config.MAX_CONTENT_LENGTH // (1024 * 1024)}MB"
    }), 413


@app.errorhandler(500)
def internal_error(error):
    app.logger.error(f"Internal server error: {error}")
    return jsonify({
        "success": False,
        "error": "Internal server error"
    }), 500


# ============================================
# Application Entry Point
# ============================================

if __name__ == '__main__':
    # Create uploads folder if it doesn't exist
    os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

    # Log startup info
    print("=" * 50)
    print("Blood Glucose Analyzer API")
    print("=" * 50)
    print(f"Upload folder: {app.config['UPLOAD_FOLDER']}")
    print(f"Max file size: {Config.MAX_CONTENT_LENGTH // (1024 * 1024)}MB")
    print(f"Allowed extensions: {', '.join(Config.ALLOWED_EXTENSIONS)}")
    print("=" * 50)

    # Check services on startup
    ocr = get_ocr_service()
    print(f"OCR Service: {'Ready' if ocr.initialized else 'Not initialized - ' + str(ocr.init_error)}")

    ml_status = check_model_status()
    print(f"ML Model: {'Ready' if ml_status.get('initialized') else 'Not initialized - ' + str(ml_status.get('error'))}")
    print("=" * 50)

    # Run the app
    port = int(os.environ.get('FLASK_RUN_PORT', 5000))
    app.run(debug=True, host='0.0.0.0', port=port)
