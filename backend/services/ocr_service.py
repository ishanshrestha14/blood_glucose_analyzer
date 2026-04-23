"""
OCR Service - Blood glucose value extraction from images using PaddleOCR

PaddleOCR chosen for:
- Superior accuracy on structured documents (95%+ vs Tesseract's 85-90%)
- Built-in table/layout detection for lab reports
- Returns text with position data for structured extraction
"""

import os
import re
from typing import Dict, List, Optional, Any

try:
    import cv2
    import numpy as np
    _CV2_AVAILABLE = True
except ImportError:
    _CV2_AVAILABLE = False

from PIL import Image

try:
    from paddleocr import PaddleOCR
    _PADDLE_AVAILABLE = True
except ImportError:
    _PADDLE_AVAILABLE = False
    PaddleOCR = None

LOW_CONFIDENCE_THRESHOLD = 0.75

# Reference range patterns — skip these when extracting glucose values
# e.g. "70-110", "< 100", "70 to 110", "3.9–6.1"
_REFERENCE_RANGE_RE = re.compile(
    r'\d+\s*[-–—]\s*\d+'      # 70-110  or  3.9–6.1
    r'|\d+\s+to\s+\d+'        # 70 to 110
    r'|[<>≤≥]\s*\d+'          # < 100  or  > 200
    r'|\d+\s*-\s*\d+\s*(?:mg|mmol|%)',  # 70-110 mg/dL
    re.IGNORECASE
)


class OCRService:
    """Service for extracting text and glucose values from lab report images."""

    GLUCOSE_KEYWORDS = {
        'fasting': [
            'fasting', 'fbs', 'fbg', 'fasting blood sugar', 'fasting glucose',
            'fasting blood glucose', 'f.b.s', 'f.b.g', 'fbs glucose'
        ],
        'hba1c': [
            'hba1c', 'hb a1c', 'a1c', 'glycated hemoglobin', 'glycated haemoglobin',
            'hemoglobin a1c', 'haemoglobin a1c', 'glycosylated hemoglobin',
            'glycohemoglobin', 'hgba1c'
        ],
        'ppbs': [
            'ppbs', 'post prandial', 'postprandial', 'pp blood sugar',
            'post meal', '2 hour', '2hr', '2-hour', 'after meal',
            'pp glucose', 'pbs'
        ],
        'rbs': [
            'rbs', 'random', 'random blood sugar', 'random glucose',
            'r.b.s', 'random blood glucose'
        ],
        'ogtt': [
            'ogtt', 'oral glucose', 'glucose tolerance', 'gtt',
            'oral glucose tolerance'
        ]
    }

    UNIT_PATTERNS = {
        'mg/dL': r'mg\s*/?\s*d[lL]|mg%',
        'mmol/L': r'mmol\s*/?\s*[lL]',
        '%': r'%'
    }

    MAX_IMAGE_DIMENSION = 2000

    def __init__(self):
        self.ocr = None
        self.initialized = False
        self.init_error = None

        if not _PADDLE_AVAILABLE:
            self.init_error = "PaddleOCR not installed. Install paddlepaddle and paddleocr to enable OCR."
            return

        try:
            self.ocr = PaddleOCR(
                use_textline_orientation=True,
                lang='en'
            )
            self.initialized = True
        except Exception as e:
            self.init_error = f"PaddleOCR initialization failed: {str(e)}"

    # ------------------------------------------------------------------
    # Image preprocessing
    # ------------------------------------------------------------------

    def preprocess_image(self, image_path: str) -> str:
        """
        Preprocess image before OCR using OpenCV pipeline:
        grayscale → resize → deskew → denoise → CLAHE → adaptive threshold.

        Falls back to PIL-only resize+convert if OpenCV is unavailable.
        """
        if _CV2_AVAILABLE:
            return self._preprocess_opencv(image_path)
        return self._preprocess_pil(image_path)

    def _preprocess_opencv(self, image_path: str) -> str:
        try:
            img = cv2.imread(image_path)
            if img is None:
                return self._preprocess_pil(image_path)

            # 1. Grayscale
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

            # 2. Resize if too large
            h, w = gray.shape
            if w > self.MAX_IMAGE_DIMENSION or h > self.MAX_IMAGE_DIMENSION:
                ratio = min(self.MAX_IMAGE_DIMENSION / w, self.MAX_IMAGE_DIMENSION / h)
                gray = cv2.resize(
                    gray,
                    (int(w * ratio), int(h * ratio)),
                    interpolation=cv2.INTER_AREA
                )

            # 3. Deskew
            gray = self._deskew(gray)

            # 4. Denoise
            denoised = cv2.fastNlMeansDenoising(
                gray, h=10, templateWindowSize=7, searchWindowSize=21
            )

            # 5. CLAHE contrast enhancement
            clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
            enhanced = clahe.apply(denoised)

            # 6. Adaptive threshold → crisp binary image
            binary = cv2.adaptiveThreshold(
                enhanced, 255,
                cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
                cv2.THRESH_BINARY,
                11, 2
            )

            preprocessed_path = image_path.rsplit('.', 1)[0] + '_preprocessed.png'
            cv2.imwrite(preprocessed_path, binary)
            return preprocessed_path

        except Exception as e:
            print(f"OpenCV preprocessing warning: {e}")
            return self._preprocess_pil(image_path)

    def _deskew(self, gray: 'np.ndarray') -> 'np.ndarray':
        """Correct skew using the minimum-area rectangle of foreground pixels."""
        try:
            _, binary = cv2.threshold(
                gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU
            )
            coords = np.column_stack(np.where(binary > 0))
            if len(coords) < 10:
                return gray
            angle = cv2.minAreaRect(coords)[-1]
            if angle < -45:
                angle = -(90 + angle)
            else:
                angle = -angle
            if abs(angle) < 0.5:
                return gray
            (h, w) = gray.shape[:2]
            M = cv2.getRotationMatrix2D((w // 2, h // 2), angle, 1.0)
            return cv2.warpAffine(
                gray, M, (w, h),
                flags=cv2.INTER_CUBIC,
                borderMode=cv2.BORDER_REPLICATE
            )
        except Exception:
            return gray

    def _preprocess_pil(self, image_path: str) -> str:
        """PIL-only fallback: convert to RGB and resize."""
        try:
            with Image.open(image_path) as img:
                if img.mode != 'RGB':
                    img = img.convert('RGB')
                width, height = img.size
                if width > self.MAX_IMAGE_DIMENSION or height > self.MAX_IMAGE_DIMENSION:
                    ratio = min(
                        self.MAX_IMAGE_DIMENSION / width,
                        self.MAX_IMAGE_DIMENSION / height
                    )
                    img = img.resize(
                        (int(width * ratio), int(height * ratio)),
                        Image.Resampling.LANCZOS
                    )
                preprocessed_path = image_path.rsplit('.', 1)[0] + '_preprocessed.png'
                img.save(preprocessed_path, 'PNG')
                return preprocessed_path
        except Exception as e:
            print(f"PIL preprocessing warning: {e}")
            return image_path

    # ------------------------------------------------------------------
    # Raw OCR
    # ------------------------------------------------------------------

    def extract_text(self, image_path: str) -> Dict[str, Any]:
        if not self.initialized:
            return {"success": False, "error": f"OCR not initialized: {self.init_error}", "text": ""}

        try:
            if not os.path.exists(image_path):
                return {"success": False, "error": f"Image file not found: {image_path}", "text": ""}

            processed_path = self.preprocess_image(image_path)
            results = list(self.ocr.predict(processed_path))

            if processed_path != image_path and os.path.exists(processed_path):
                os.remove(processed_path)

            if not results or not results[0].get('rec_texts'):
                return {"success": True, "text": "", "message": "No text detected in image"}

            full_text = '\n'.join(results[0]['rec_texts'])
            return {"success": True, "text": full_text}

        except Exception as e:
            return {"success": False, "error": f"OCR processing error: {str(e)}", "text": ""}

    def extract_text_with_positions(self, image_path: str) -> Dict[str, Any]:
        if not self.initialized:
            return {"success": False, "error": f"OCR not initialized: {self.init_error}", "text_blocks": []}

        try:
            if not os.path.exists(image_path):
                return {"success": False, "error": f"Image file not found: {image_path}", "text_blocks": []}

            processed_path = self.preprocess_image(image_path)
            results = list(self.ocr.predict(processed_path))

            if processed_path != image_path and os.path.exists(processed_path):
                os.remove(processed_path)

            if not results or not results[0].get('rec_texts'):
                return {"success": True, "text_blocks": [], "message": "No text detected in image"}

            page = results[0]
            rec_texts = page['rec_texts']
            rec_scores = page['rec_scores']
            dt_polys = page['dt_polys']

            text_blocks = []
            for text, confidence, bbox in zip(rec_texts, rec_scores, dt_polys):
                poly = bbox.tolist() if hasattr(bbox, 'tolist') else bbox
                x_coords = [point[0] for point in poly]
                y_coords = [point[1] for point in poly]

                text_blocks.append({
                    "text": text,
                    "confidence": float(confidence),
                    "bbox": {
                        "x_min": min(x_coords),
                        "y_min": min(y_coords),
                        "x_max": max(x_coords),
                        "y_max": max(y_coords),
                        "center_y": (min(y_coords) + max(y_coords)) / 2
                    },
                    "raw_bbox": poly
                })

            return {"success": True, "text_blocks": text_blocks}

        except Exception as e:
            return {"success": False, "error": f"OCR processing error: {str(e)}", "text_blocks": []}

    # ------------------------------------------------------------------
    # Spatial helpers
    # ------------------------------------------------------------------

    def _group_by_rows(self, text_blocks: List[Dict], y_threshold: Optional[float] = None) -> List[List[Dict]]:
        """
        Group text blocks into rows by y-coordinate proximity.

        y_threshold defaults to 60% of the median text-block height so it
        self-calibrates across different image DPIs instead of using a fixed 20px.
        """
        if not text_blocks:
            return []

        if y_threshold is None:
            heights = [
                b['bbox']['y_max'] - b['bbox']['y_min']
                for b in text_blocks
                if b['bbox']['y_max'] > b['bbox']['y_min']
            ]
            if heights:
                median_height = sorted(heights)[len(heights) // 2]
                y_threshold = max(10, median_height * 0.6)
            else:
                y_threshold = 20

        sorted_blocks = sorted(text_blocks, key=lambda b: b['bbox']['center_y'])

        rows: List[List[Dict]] = []
        current_row = [sorted_blocks[0]]
        current_y = sorted_blocks[0]['bbox']['center_y']

        for block in sorted_blocks[1:]:
            block_y = block['bbox']['center_y']
            if abs(block_y - current_y) <= y_threshold:
                current_row.append(block)
            else:
                current_row.sort(key=lambda b: b['bbox']['x_min'])
                rows.append(current_row)
                current_row = [block]
                current_y = block_y

        if current_row:
            current_row.sort(key=lambda b: b['bbox']['x_min'])
            rows.append(current_row)

        return rows

    def _find_test_type(self, text: str) -> Optional[str]:
        text_lower = text.lower()
        for test_type, keywords in self.GLUCOSE_KEYWORDS.items():
            for keyword in keywords:
                if keyword in text_lower:
                    return test_type
        return None

    def _is_reference_range(self, text: str) -> bool:
        """Return True if text looks like a reference/normal range, not a result value."""
        return bool(_REFERENCE_RANGE_RE.search(text))

    def _extract_number(self, text: str) -> Optional[float]:
        """Extract a single numeric value, rejecting reference-range strings."""
        if self._is_reference_range(text):
            return None

        patterns = [
            r'(\d+\.?\d*)',
            r'(\d+,\d+)',
        ]
        for pattern in patterns:
            match = re.search(pattern, text)
            if match:
                num_str = match.group(1).replace(',', '.')
                try:
                    return float(num_str)
                except ValueError:
                    continue
        return None

    def _extract_unit(self, text: str) -> Optional[str]:
        text_lower = text.lower()
        for unit, pattern in self.UNIT_PATTERNS.items():
            if re.search(pattern, text_lower):
                return unit
        return None

    def _infer_unit(self, test_type: str, value: float) -> str:
        if test_type == 'hba1c':
            return '%'
        return 'mmol/L' if value < 30 else 'mg/dL'

    # ------------------------------------------------------------------
    # Main extraction
    # ------------------------------------------------------------------

    def extract_glucose_values(self, image_path: str) -> Dict[str, Any]:
        """
        Extract glucose values from a lab report image.

        Returns:
            raw_text, detected_values (list, backward-compat),
            extracted_fields (dict keyed by test_type with confidence metadata),
            extraction_success
        """
        ocr_result = self.extract_text_with_positions(image_path)

        if not ocr_result['success']:
            return {
                "raw_text": "",
                "detected_values": [],
                "extracted_fields": {},
                "extraction_success": False,
                "error": ocr_result.get('error', 'OCR failed')
            }

        text_blocks = ocr_result.get('text_blocks', [])

        if not text_blocks:
            return {
                "raw_text": "",
                "detected_values": [],
                "extracted_fields": {},
                "extraction_success": True,
                "message": "No text detected in image"
            }

        raw_text = ' '.join([block['text'] for block in text_blocks])
        rows = self._group_by_rows(text_blocks)

        detected_values = []
        processed_test_types: set = set()

        for row in rows:
            row_text = ' '.join([block['text'] for block in row])
            test_type = self._find_test_type(row_text)

            if test_type and test_type not in processed_test_types:
                values_found = []
                units_found = []
                confidence_sum = 0.0

                for block in row:
                    # Skip blocks that look like reference ranges
                    if self._is_reference_range(block['text']):
                        continue

                    number = self._extract_number(block['text'])
                    if number is not None:
                        if test_type == 'hba1c':
                            if 3 <= number <= 20:
                                values_found.append(number)
                                confidence_sum += block['confidence']
                        else:
                            if 1 <= number <= 700:
                                values_found.append(number)
                                confidence_sum += block['confidence']

                    unit = self._extract_unit(block['text'])
                    if unit:
                        units_found.append(unit)

                if not values_found:
                    # Look one row ahead for the value (multi-line table entries)
                    row_index = rows.index(row)
                    if row_index + 1 < len(rows):
                        next_row = rows[row_index + 1]
                        for block in next_row:
                            if self._is_reference_range(block['text']):
                                continue
                            number = self._extract_number(block['text'])
                            if number is not None:
                                if test_type == 'hba1c' and 3 <= number <= 20:
                                    values_found.append(number)
                                    confidence_sum += block['confidence']
                                elif test_type != 'hba1c' and 1 <= number <= 700:
                                    values_found.append(number)
                                    confidence_sum += block['confidence']
                            unit = self._extract_unit(block['text'])
                            if unit:
                                units_found.append(unit)

                if values_found:
                    value = values_found[0]
                    unit = units_found[0] if units_found else self._infer_unit(test_type, value)
                    confidence = round(confidence_sum / len(values_found), 2)

                    detected_values.append({
                        "test_type": test_type,
                        "value": value,
                        "unit": unit,
                        "confidence": confidence,
                        "row_text": row_text
                    })
                    processed_test_types.add(test_type)

        if not detected_values:
            detected_values = self._fallback_extraction(text_blocks, processed_test_types)

        # Build extracted_fields dict for confidence-aware frontend UX
        extracted_fields: Dict[str, Any] = {}
        for dv in detected_values:
            extracted_fields[dv['test_type']] = {
                "value": dv['value'],
                "unit": dv['unit'],
                "confidence": dv['confidence'],
                "low_confidence": dv['confidence'] < LOW_CONFIDENCE_THRESHOLD,
            }

        return {
            "raw_text": raw_text,
            "detected_values": detected_values,
            "extracted_fields": extracted_fields,
            "extraction_success": True
        }

    def _fallback_extraction(self, text_blocks: List[Dict], already_found: set) -> List[Dict]:
        """Fallback: scan full text for keyword→number patterns when row-based detection fails."""
        detected_values = []
        full_text = ' '.join([b['text'] for b in text_blocks])

        for test_type, keywords in self.GLUCOSE_KEYWORDS.items():
            if test_type in already_found:
                continue

            for keyword in keywords:
                if keyword in full_text.lower():
                    pattern = rf'{keyword}[^\d]*(\d+\.?\d*)'
                    match = re.search(pattern, full_text.lower())

                    if match:
                        try:
                            value = float(match.group(1))
                            if test_type == 'hba1c' and not (3 <= value <= 20):
                                continue
                            elif test_type != 'hba1c' and not (1 <= value <= 700):
                                continue

                            unit = self._infer_unit(test_type, value)
                            detected_values.append({
                                "test_type": test_type,
                                "value": value,
                                "unit": unit,
                                "confidence": 0.70,
                                "extraction_method": "fallback"
                            })
                            already_found.add(test_type)
                            break
                        except ValueError:
                            continue

        return detected_values


# ------------------------------------------------------------------
# Singleton
# ------------------------------------------------------------------

_ocr_service_instance = None


def get_ocr_service() -> OCRService:
    global _ocr_service_instance
    if _ocr_service_instance is None:
        _ocr_service_instance = OCRService()
    return _ocr_service_instance


def extract_text(image_path: str) -> Dict[str, Any]:
    return get_ocr_service().extract_text(image_path)


def extract_text_with_positions(image_path: str) -> Dict[str, Any]:
    return get_ocr_service().extract_text_with_positions(image_path)


def extract_glucose_values(image_path: str) -> Dict[str, Any]:
    return get_ocr_service().extract_glucose_values(image_path)
