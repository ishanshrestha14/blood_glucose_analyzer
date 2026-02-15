"""
Generate a sample blood glucose lab report image for testing the OCR pipeline.

Usage:
    python generate_sample_report.py

Output:
    sample_reports/sample_glucose_report.png
"""

import os
from PIL import Image, ImageDraw, ImageFont


def generate_report():
    # Image setup — large enough for clear OCR
    width, height = 800, 1000
    img = Image.new('RGB', (width, height), 'white')
    draw = ImageDraw.Draw(img)

    # Use a large default font for OCR readability
    try:
        font_title = ImageFont.truetype("arial.ttf", 28)
        font_heading = ImageFont.truetype("arial.ttf", 20)
        font_body = ImageFont.truetype("arial.ttf", 18)
        font_small = ImageFont.truetype("arial.ttf", 14)
    except OSError:
        # Fallback to default font scaled via fontsize (Pillow 10+)
        font_title = ImageFont.load_default(size=28)
        font_heading = ImageFont.load_default(size=20)
        font_body = ImageFont.load_default(size=18)
        font_small = ImageFont.load_default(size=14)

    y = 30

    # --- Header ---
    draw.text((width // 2, y), "CITY MEDICAL LABORATORY", fill='darkblue',
              font=font_title, anchor='mt')
    y += 40
    draw.text((width // 2, y), "Kathmandu, Nepal  |  Phone: 01-4XXXXXX",
              fill='gray', font=font_small, anchor='mt')
    y += 30

    # Divider
    draw.line([(40, y), (width - 40, y)], fill='darkblue', width=2)
    y += 20

    # --- Report title ---
    draw.text((width // 2, y), "BIOCHEMISTRY REPORT", fill='black',
              font=font_heading, anchor='mt')
    y += 40

    # --- Patient info ---
    info = [
        ("Patient Name:", "Ram Sharma"),
        ("Age / Gender:", "45 Years / Male"),
        ("Report Date:", "2026-02-15"),
        ("Sample Type:", "Blood (Serum)"),
        ("Referred By:", "Dr. A. Thapa"),
    ]
    for label, value in info:
        draw.text((60, y), label, fill='black', font=font_body)
        draw.text((250, y), value, fill='black', font=font_body)
        y += 28

    y += 15
    draw.line([(40, y), (width - 40, y)], fill='gray', width=1)
    y += 20

    # --- Table header ---
    col_test = 60
    col_result = 340
    col_unit = 480
    col_ref = 600

    draw.text((col_test, y), "Test Name", fill='black', font=font_heading)
    draw.text((col_result, y), "Result", fill='black', font=font_heading)
    draw.text((col_unit, y), "Unit", fill='black', font=font_heading)
    draw.text((col_ref, y), "Reference", fill='black', font=font_heading)
    y += 30
    draw.line([(40, y), (width - 40, y)], fill='black', width=1)
    y += 15

    # --- Test results ---
    tests = [
        ("Fasting Blood Sugar (FBS)", "118", "mg/dL", "70 - 100"),
        ("HbA1c", "6.1", "%", "< 5.7"),
        ("Post Prandial Blood Sugar", "155", "mg/dL", "< 140"),
    ]

    for test_name, result, unit, ref_range in tests:
        draw.text((col_test, y), test_name, fill='black', font=font_body)
        draw.text((col_result, y), result, fill='black', font=font_body)
        draw.text((col_unit, y), unit, fill='black', font=font_body)
        draw.text((col_ref, y), ref_range, fill='gray', font=font_body)
        y += 35

    y += 15
    draw.line([(40, y), (width - 40, y)], fill='gray', width=1)
    y += 30

    # --- Footer notes ---
    draw.text((60, y), "Note: This report is for diagnostic purposes only.",
              fill='gray', font=font_small)
    y += 25
    draw.text((60, y), "Please consult your physician for interpretation.",
              fill='gray', font=font_small)
    y += 50

    # Border
    draw.rectangle([(20, 10), (width - 20, y + 20)], outline='darkblue', width=2)

    # Save
    out_dir = os.path.join(os.path.dirname(__file__), 'sample_reports')
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, 'sample_glucose_report.png')
    img.save(out_path, 'PNG')
    print(f"Sample report saved to: {out_path}")
    return out_path


if __name__ == '__main__':
    generate_report()
