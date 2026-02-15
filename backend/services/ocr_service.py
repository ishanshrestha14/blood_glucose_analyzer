"""
OCR Service - Blood glucose value extraction from images using PaddleOCR

PaddleOCR chosen for:
- Superior accuracy on structured documents (95%+ vs Tesseract's 85-90%)
- Built-in table/layout detection for lab reports
- Returns text with position data for structured extraction
"""

import os
import re
from typing import Dict, List, Optional, Tuple, Any
from PIL import Image
from paddleocr import PaddleOCR


class OCRService:
    """Service for extracting text and glucose values from lab report images."""

    # Glucose-related keywords for different test types
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

    # Unit patterns
    UNIT_PATTERNS = {
        'mg/dL': r'mg\s*/?\s*d[lL]|mg%',
        'mmol/L': r'mmol\s*/?\s*[lL]',
        '%': r'%'  # For HbA1c
    }

    # Maximum image dimension for performance
    MAX_IMAGE_DIMENSION = 2000

    def __init__(self):
        """Initialize PaddleOCR with English language support."""
        self.ocr = None
        self.initialized = False
        self.init_error = None

        try:
            # Initialize PaddleOCR v3.x
            # use_textline_orientation: detect text orientation
            # lang: language (en for English)
            self.ocr = PaddleOCR(
                use_textline_orientation=True,
                lang='en'
            )
            self.initialized = True
            self.init_error = None
        except ImportError as e:
            self.initialized = False
            self.init_error = f"PaddleOCR not installed: {str(e)}. Install with: pip install paddleocr paddlepaddle"
        except Exception as e:
            self.initialized = False
            self.init_error = f"PaddleOCR initialization failed: {str(e)}"

    def preprocess_image(self, image_path: str) -> str:
        """
        Preprocess image before OCR.

        Args:
            image_path: Path to the image file

        Returns:
            Path to preprocessed image (may be same as input if no changes needed)
        """
        try:
            with Image.open(image_path) as img:
                # Convert to RGB if needed (PaddleOCR works best with RGB)
                if img.mode != 'RGB':
                    img = img.convert('RGB')

                # Resize if too large (for performance)
                width, height = img.size
                if width > self.MAX_IMAGE_DIMENSION or height > self.MAX_IMAGE_DIMENSION:
                    # Calculate new dimensions maintaining aspect ratio
                    ratio = min(
                        self.MAX_IMAGE_DIMENSION / width,
                        self.MAX_IMAGE_DIMENSION / height
                    )
                    new_width = int(width * ratio)
                    new_height = int(height * ratio)
                    img = img.resize((new_width, new_height), Image.Resampling.LANCZOS)

                # Save preprocessed image
                preprocessed_path = image_path.rsplit('.', 1)[0] + '_preprocessed.png'
                img.save(preprocessed_path, 'PNG')
                return preprocessed_path

        except Exception as e:
            # If preprocessing fails, return original path
            print(f"Image preprocessing warning: {e}")
            return image_path

    def extract_text(self, image_path: str) -> Dict[str, Any]:
        """
        Extract raw text from image.

        Args:
            image_path: Path to the image file

        Returns:
            Dictionary with extracted text and status
        """
        if not self.initialized:
            return {
                "success": False,
                "error": f"OCR not initialized: {self.init_error}",
                "text": ""
            }

        try:
            # Check if file exists
            if not os.path.exists(image_path):
                return {
                    "success": False,
                    "error": f"Image file not found: {image_path}",
                    "text": ""
                }

            # Preprocess image
            processed_path = self.preprocess_image(image_path)

            # Run OCR (PaddleOCR v3.x uses predict(), returns generator of OCRResult)
            results = list(self.ocr.predict(processed_path))

            # Clean up preprocessed image if different from original
            if processed_path != image_path and os.path.exists(processed_path):
                os.remove(processed_path)

            # PaddleOCR v3.x returns OCRResult dicts with rec_texts, rec_scores, dt_polys
            if not results or not results[0].get('rec_texts'):
                return {
                    "success": True,
                    "text": "",
                    "message": "No text detected in image"
                }

            # Combine all detected text
            full_text = '\n'.join(results[0]['rec_texts'])

            return {
                "success": True,
                "text": full_text
            }

        except Exception as e:
            return {
                "success": False,
                "error": f"OCR processing error: {str(e)}",
                "text": ""
            }

    def extract_text_with_positions(self, image_path: str) -> Dict[str, Any]:
        """
        Extract text with bounding box positions from image.

        Args:
            image_path: Path to the image file

        Returns:
            Dictionary with text blocks including positions and confidence scores
        """
        if not self.initialized:
            return {
                "success": False,
                "error": f"OCR not initialized: {self.init_error}",
                "text_blocks": []
            }

        try:
            # Check if file exists
            if not os.path.exists(image_path):
                return {
                    "success": False,
                    "error": f"Image file not found: {image_path}",
                    "text_blocks": []
                }

            # Preprocess image
            processed_path = self.preprocess_image(image_path)

            # Run OCR (PaddleOCR v3.x uses predict(), returns generator of OCRResult)
            results = list(self.ocr.predict(processed_path))

            # Clean up preprocessed image if different from original
            if processed_path != image_path and os.path.exists(processed_path):
                os.remove(processed_path)

            # PaddleOCR v3.x returns OCRResult dicts with rec_texts, rec_scores, dt_polys
            if not results or not results[0].get('rec_texts'):
                return {
                    "success": True,
                    "text_blocks": [],
                    "message": "No text detected in image"
                }

            page = results[0]
            rec_texts = page['rec_texts']
            rec_scores = page['rec_scores']
            dt_polys = page['dt_polys']

            # Parse result with positions
            # dt_polys are numpy arrays of shape (4, 2) — four corners [x, y]
            text_blocks = []
            for text, confidence, bbox in zip(rec_texts, rec_scores, dt_polys):
                # bbox is numpy array shape (4, 2)
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

            return {
                "success": True,
                "text_blocks": text_blocks
            }

        except Exception as e:
            return {
                "success": False,
                "error": f"OCR processing error: {str(e)}",
                "text_blocks": []
            }

    def _group_by_rows(self, text_blocks: List[Dict], y_threshold: float = 20) -> List[List[Dict]]:
        """
        Group text blocks by rows based on y-coordinate proximity.

        Args:
            text_blocks: List of text blocks with position data
            y_threshold: Maximum y-distance to consider same row

        Returns:
            List of rows, each containing text blocks in that row
        """
        if not text_blocks:
            return []

        # Sort by center_y coordinate
        sorted_blocks = sorted(text_blocks, key=lambda b: b['bbox']['center_y'])

        rows = []
        current_row = [sorted_blocks[0]]
        current_y = sorted_blocks[0]['bbox']['center_y']

        for block in sorted_blocks[1:]:
            block_y = block['bbox']['center_y']

            if abs(block_y - current_y) <= y_threshold:
                # Same row
                current_row.append(block)
            else:
                # New row
                # Sort current row by x coordinate (left to right)
                current_row.sort(key=lambda b: b['bbox']['x_min'])
                rows.append(current_row)
                current_row = [block]
                current_y = block_y

        # Add last row
        if current_row:
            current_row.sort(key=lambda b: b['bbox']['x_min'])
            rows.append(current_row)

        return rows

    def _find_test_type(self, text: str) -> Optional[str]:
        """
        Identify the glucose test type from text.

        Args:
            text: Text to analyze

        Returns:
            Test type identifier or None
        """
        text_lower = text.lower()

        for test_type, keywords in self.GLUCOSE_KEYWORDS.items():
            for keyword in keywords:
                if keyword in text_lower:
                    return test_type

        return None

    def _extract_number(self, text: str) -> Optional[float]:
        """
        Extract numeric value from text.

        Args:
            text: Text containing a number

        Returns:
            Extracted number or None
        """
        # Pattern for numbers (including decimals)
        # Handles: 105, 105.5, 6.2, etc.
        patterns = [
            r'(\d+\.?\d*)',  # Standard number
            r'(\d+,\d+)',    # Comma as decimal separator
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
        """
        Extract unit from text.

        Args:
            text: Text containing a unit

        Returns:
            Standardized unit or None
        """
        text_lower = text.lower()

        for unit, pattern in self.UNIT_PATTERNS.items():
            if re.search(pattern, text_lower):
                return unit

        return None

    def _infer_unit(self, test_type: str, value: float) -> str:
        """
        Infer unit based on test type and value.

        Args:
            test_type: Type of glucose test
            value: Numeric value

        Returns:
            Inferred unit
        """
        if test_type == 'hba1c':
            return '%'

        # For other tests, infer based on value range
        # mg/dL values are typically 50-400
        # mmol/L values are typically 2.8-22.2
        if value < 30:
            return 'mmol/L'
        else:
            return 'mg/dL'

    def extract_glucose_values(self, image_path: str) -> Dict[str, Any]:
        """
        Extract glucose values from a lab report image.

        Uses position data to understand table structure and extract
        glucose test results with their values and units.

        Args:
            image_path: Path to the lab report image

        Returns:
            Dictionary containing:
            - raw_text: Full extracted text
            - detected_values: List of detected glucose values
            - extraction_success: Boolean indicating success
        """
        # Get text with positions
        ocr_result = self.extract_text_with_positions(image_path)

        if not ocr_result['success']:
            return {
                "raw_text": "",
                "detected_values": [],
                "extraction_success": False,
                "error": ocr_result.get('error', 'OCR failed')
            }

        text_blocks = ocr_result.get('text_blocks', [])

        if not text_blocks:
            return {
                "raw_text": "",
                "detected_values": [],
                "extraction_success": True,
                "message": "No text detected in image"
            }

        # Build raw text
        raw_text = ' '.join([block['text'] for block in text_blocks])

        # Group text blocks by rows
        rows = self._group_by_rows(text_blocks)

        detected_values = []
        processed_test_types = set()  # Avoid duplicates

        # Process each row
        for row in rows:
            row_text = ' '.join([block['text'] for block in row])

            # Check if row contains a glucose-related keyword
            test_type = self._find_test_type(row_text)

            if test_type and test_type not in processed_test_types:
                # Find numeric values in the row
                values_found = []
                units_found = []
                avg_confidence = 0

                for block in row:
                    # Extract number
                    number = self._extract_number(block['text'])
                    if number is not None:
                        # Filter out unreasonable values
                        # Glucose: 20-700 mg/dL or 1-40 mmol/L
                        # HbA1c: 3-20%
                        if test_type == 'hba1c':
                            if 3 <= number <= 20:
                                values_found.append(number)
                                avg_confidence += block['confidence']
                        else:
                            if 1 <= number <= 700:
                                values_found.append(number)
                                avg_confidence += block['confidence']

                    # Extract unit
                    unit = self._extract_unit(block['text'])
                    if unit:
                        units_found.append(unit)

                # If we found a value, add to results
                if values_found:
                    # Take the most likely value (usually the first numeric value after keyword)
                    value = values_found[0]

                    # Determine unit
                    if units_found:
                        unit = units_found[0]
                    else:
                        unit = self._infer_unit(test_type, value)

                    # Calculate average confidence
                    confidence = avg_confidence / len(values_found) if values_found else 0.0

                    detected_values.append({
                        "test_type": test_type,
                        "value": value,
                        "unit": unit,
                        "confidence": round(confidence, 2),
                        "row_text": row_text  # For debugging
                    })

                    processed_test_types.add(test_type)

        # Also try to find values without row grouping (fallback)
        # This helps when OCR doesn't properly detect table structure
        if not detected_values:
            detected_values = self._fallback_extraction(text_blocks, processed_test_types)

        return {
            "raw_text": raw_text,
            "detected_values": detected_values,
            "extraction_success": True
        }

    def _fallback_extraction(self, text_blocks: List[Dict],
                             already_found: set) -> List[Dict]:
        """
        Fallback extraction when row-based detection fails.

        Looks for test keywords and nearby numeric values.
        """
        detected_values = []
        full_text = ' '.join([b['text'] for b in text_blocks])

        for test_type, keywords in self.GLUCOSE_KEYWORDS.items():
            if test_type in already_found:
                continue

            for keyword in keywords:
                if keyword in full_text.lower():
                    # Find a number near this keyword
                    # Look for pattern: keyword ... number
                    pattern = rf'{keyword}[^\d]*(\d+\.?\d*)'
                    match = re.search(pattern, full_text.lower())

                    if match:
                        try:
                            value = float(match.group(1))

                            # Validate value range
                            if test_type == 'hba1c' and not (3 <= value <= 20):
                                continue
                            elif test_type != 'hba1c' and not (1 <= value <= 700):
                                continue

                            unit = self._infer_unit(test_type, value)

                            # Lower confidence for fallback extraction
                            detected_values.append({
                                "test_type": test_type,
                                "value": value,
                                "unit": unit,
                                "confidence": 0.70,
                                "extraction_method": "fallback"
                            })

                            already_found.add(test_type)
                            break  # Move to next test type

                        except ValueError:
                            continue

        return detected_values


# Singleton instance for use in the application
_ocr_service_instance = None


def get_ocr_service() -> OCRService:
    """Get or create the OCR service singleton."""
    global _ocr_service_instance
    if _ocr_service_instance is None:
        _ocr_service_instance = OCRService()
    return _ocr_service_instance


# Convenience functions for direct usage
def extract_text(image_path: str) -> Dict[str, Any]:
    """Extract raw text from an image."""
    service = get_ocr_service()
    return service.extract_text(image_path)


def extract_text_with_positions(image_path: str) -> Dict[str, Any]:
    """Extract text with positions from an image."""
    service = get_ocr_service()
    return service.extract_text_with_positions(image_path)


def extract_glucose_values(image_path: str) -> Dict[str, Any]:
    """Extract glucose values from a lab report image."""
    service = get_ocr_service()
    return service.extract_glucose_values(image_path)
