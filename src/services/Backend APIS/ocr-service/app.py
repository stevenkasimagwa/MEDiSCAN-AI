import os
from flask import Flask, request, jsonify
from flask_cors import CORS
from werkzeug.utils import secure_filename
from dotenv import load_dotenv
import uuid
import shutil
import pytesseract
pytesseract.pytesseract.tesseract_cmd = r"C:\Program Files\Tesseract-OCR\tesseract.exe"


from ocr import set_tesseract_cmd, file_to_text
import re

def normalize_lines(text):
    # split and strip empty lines
    return [line.strip() for line in text.splitlines() if line.strip()]

def extract_field_by_label(lines, label_patterns):
    """
    Search for common label patterns like 'Name:', 'Patient Name:', etc.
    label_patterns: list of regex patterns (case-insensitive)
    Returns first matched value or None.
    """
    for line in lines:
        for pat in label_patterns:
            m = re.search(pat, line, flags=re.I)
            if m:
                # If pattern uses a capturing group for value, use it; else split by colon
                if m.groups():
                    return m.group(1).strip()
                parts = re.split(r':', line, maxsplit=1)
                if len(parts) > 1:
                    return parts[1].strip()
    return None

def find_age(lines):
    # common patterns: Age: 34 or 34 yrs or Age - 34
    for line in lines:
        m = re.search(r'Age\s*[:\-]?\s*(\d{1,3})\b', line, flags=re.I)
        if m:
            return m.group(1)
        m = re.search(r'(\d{1,3})\s*(yrs|years|yo)\b', line, flags=re.I)
        if m:
            return m.group(1)
    return None

def find_sex(lines):
    for line in lines:
        m = re.search(r'\b(Sex|Gender)\s*[:\-]?\s*(M|F|Male|Female)\b', line, flags=re.I)
        if m:
            return m.group(2).strip()
        # single letter M or F on its own
        if re.fullmatch(r'\bM\b', line, flags=re.I):
            return 'M'
        if re.fullmatch(r'\bF\b', line, flags=re.I):
            return 'F'
    return None

def find_medications(lines):
    meds = []
    # look for lines starting with Medication(s) or Rx or Drugs
    capture = False
    for line in lines:
        if re.search(r'^(Medications|Medication|Rx|Drugs)\b[:\-]?', line, flags=re.I):
            # capture this line (value after colon) and following indented lines until blank
            parts = re.split(r':', line, maxsplit=1)
            if len(parts) > 1 and parts[1].strip():
                meds.append(parts[1].strip())
            capture = True
            continue
        if capture:
            if line.strip() == '':
                break
            # stop capture if next header appears
            if re.match(r'^[A-Z][a-z]+\s*[:\-]', line):
                break
            meds.append(line.strip())
    if meds:
        return " ".join(meds)
    return None

def extract_fields_from_text(text):
    lines = normalize_lines(text)

    patient_name = extract_field_by_label(lines, [
        r'^(?:Patient Name|Name|Pt Name|Patient)\s*[:\-]\s*(.*)$',
        r'^(?:Name)\s*[:-]\s*(.*)$'
    ]) or (lines[0] if lines else None)

    age = find_age(lines)
    sex = find_sex(lines)

    diagnosis = extract_field_by_label(lines, [
        r'^(?:Diagnosis|Dx)\s*[:\-]?\s*(.*)$'
    ])

    medications = find_medications(lines)

    # Try to use the quick regex parser from parse_medical_record if available for richer fields
    parsed = {}
    try:
        from parse_medical_record import parse_medical_record_quick
        parsed = parse_medical_record_quick(text) or {}
    except Exception:
        parsed = {}

    # Merge results, keep existing extraction as fallback
    result = {
        'patient_name': parsed.get('name') or patient_name,
        'age': parsed.get('age') or age,
        'sex': parsed.get('sex') or sex,
        'diagnosis': parsed.get('diagnosis') or diagnosis,
        'medications': parsed.get('prescription') or medications,
        'blood_pressure': parsed.get('blood_pressure'),
        'weight': parsed.get('weight'),
        'raw_text': text
    }

    return result


load_dotenv()

UPLOAD_FOLDER = os.getenv('TMP_FOLDER', './tmp')
ALLOWED_EXT = {'.png', '.jpg', '.jpeg', '.tiff', '.bmp', '.pdf'}
MAX_CONTENT = int(os.getenv('MAX_CONTENT_LENGTH', 10 * 1024 * 1024))  # 10MB default
TESSERACT_CMD = os.getenv('TESSERACT_CMD', '')

set_tesseract_cmd(TESSERACT_CMD)

os.makedirs(UPLOAD_FOLDER, exist_ok=True)

app = Flask(__name__)
CORS(app)
app.config['MAX_CONTENT_LENGTH'] = MAX_CONTENT

def allowed_file(filename):
    ext = os.path.splitext(filename)[1].lower()
    return ext in ALLOWED_EXT

@app.route('/api/ocr/extract-text', methods=['POST'])
def extract_text_route():
    """
    Accepts multipart/form-data with 'file'; returns { success: true, text: '...' }
    """
    if 'file' not in request.files:
        return jsonify({'success': False, 'error': 'No file part'}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({'success': False, 'error': 'No file selected'}), 400
    filename = secure_filename(file.filename)
    if not allowed_file(filename):
        return jsonify({'success': False, 'error': 'Unsupported file type'}), 400

    tmp_name = f"{uuid.uuid4().hex}_{filename}"
    save_path = os.path.join(UPLOAD_FOLDER, tmp_name)
    try:
        file.save(save_path)
        text = file_to_text(save_path)
        return jsonify({'success': True, 'text': text})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500
    finally:
        # cleanup
        try:
            if os.path.exists(save_path):
                os.remove(save_path)
        except:
            pass

@app.route('/api/ocr/extract-fields', methods=['POST'])
def extract_fields_route():
    """
    Accepts either:
      - multipart/form-data 'file' OR
      - JSON body { text: "..." }
    Returns parsed fields JSON
    """
    text = None
    if request.content_type and 'multipart/form-data' in request.content_type:
        if 'file' not in request.files:
            return jsonify({'success': False, 'error': 'No file part'}), 400
        file = request.files['file']
        filename = secure_filename(file.filename)
        if not allowed_file(filename):
            return jsonify({'success': False, 'error': 'Unsupported file type'}), 400
        tmp_name = f"{uuid.uuid4().hex}_{filename}"
        save_path = os.path.join(UPLOAD_FOLDER, tmp_name)
        try:
            file.save(save_path)
            text = file_to_text(save_path)
        except Exception as e:
            return jsonify({'success': False, 'error': str(e)}), 500
        finally:
            try:
                if os.path.exists(save_path):
                    os.remove(save_path)
            except:
                pass
    else:
        body = request.get_json(silent=True) or {}
        text = body.get('text')

    if not text:
        return jsonify({'success': False, 'error': 'No text provided'}), 400

    fields = extract_fields_from_text(text)
    return jsonify({'success': True, 'fields': fields})

if __name__ == '__main__':
    port = int(os.getenv('PORT', 3002))
    app.run(host='0.0.0.0', port=port, debug=True)
