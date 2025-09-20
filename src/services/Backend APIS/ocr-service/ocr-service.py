from flask import Flask, request, jsonify
from flask_cors import CORS
import os
from PIL import Image
import pytesseract
from pdf2image import convert_from_path
import tempfile
import spacy
import re
import cv2
import numpy as np
import statistics

# Load spaCy model
nlp = spacy.load("en_core_web_sm")

# Try to import the enhanced parser if available
try:
    from parse_enhanced import parse_fields_enhanced
except Exception:
    parse_fields_enhanced = None

# OCR functions
def image_to_text(image_path, lang='eng'):
    # Preprocess image for better OCR quality
    proc_path = preprocess_image(image_path)
    text = pytesseract.image_to_string(Image.open(proc_path), lang=lang)
    return text

def pdf_to_text(pdf_path, lang='eng'):
    pages = convert_from_path(pdf_path)
    all_text = []
    for page in pages:
        with tempfile.NamedTemporaryFile(suffix='.png', delete=True) as tmpf:
            page.save(tmpf.name, 'PNG')
            txt = pytesseract.image_to_string(Image.open(tmpf.name), lang=lang)
            all_text.append(txt)
    return "\n\n".join(all_text)

def file_to_text(filepath, lang='eng'):
    ext = os.path.splitext(filepath)[1].lower()
    if ext in ['.png', '.jpg', '.jpeg', '.tiff', '.bmp']:
        return image_to_text(filepath, lang=lang)
    elif ext == '.pdf':
        return pdf_to_text(filepath, lang=lang)
    else:
        try:
            return image_to_text(filepath, lang=lang)
        except Exception as e:
            raise ValueError(f"Unsupported file type: {ext}") from e


def compute_confidences(image_path):
    """Run pytesseract.image_to_data and compute simple word-level confidences.
    Returns avg_confidence (0-100) and a map of tokens->confidence (approx).
    """
    img = Image.open(image_path)
    data = pytesseract.image_to_data(img, output_type=pytesseract.Output.DICT)
    confs = []
    tokens = []
    for i, word in enumerate(data.get('text', [])):
        try:
            conf = int(data.get('conf', [])[i])
        except Exception:
            conf = -1
        if word and conf >= 0:
            confs.append(conf)
            tokens.append((word, conf))

    avg = int(statistics.mean(confs)) if confs else 0
    return avg, tokens

# spaCy field parser
def parse_fields_with_spacy(raw_text):
    doc = nlp(raw_text)
    fields = {
        "patient_name": None,
        "age": None,
        "sex": None,
        "diagnosis": None,
        "medications": None,
        "raw_text": raw_text
    }
    # --- Patient Name ---
    # Prefer explicit labeled fields first (Full Name, Patient Name, Name). These are more reliable than NER on headers.
    m_label = re.search(r"(?:Full Name|Patient Name|Patient|Name)\s*[:\-]\s*(.+)", raw_text, re.IGNORECASE)
    if m_label:
        candidate = m_label.group(1).split('\n')[0].strip()
        if len(candidate) > 1 and len(candidate.split()) <= 6:
            fields["patient_name"] = candidate

    # If no labeled name, fall back to NER PERSON extraction (first reasonably sized PERSON)
    if not fields["patient_name"]:
        for ent in doc.ents:
            if ent.label_ == "PERSON":
                text = ent.text.strip()
                if 1 < len(text.split()) <= 6:
                    fields["patient_name"] = text
                    break

    # --- Age (regex) ---
    age_match = re.search(r"Age\s*[:\-]?\s*(\d+)", raw_text, re.IGNORECASE)
    if age_match:
        fields["age"] = int(age_match.group(1))

    # --- Sex (regex) ---
    sex_match = re.search(r"\b(Male|Female|M|F)\b", raw_text, re.IGNORECASE)
    if sex_match:
        fields["sex"] = sex_match.group(1).capitalize()

    # --- Diagnosis (look for keyword) ---
    for sent in doc.sents:
        if "diagnosis" in sent.text.lower() or "assessment" in sent.text.lower():
            fields["diagnosis"] = sent.text.strip()

    # Fallback: capture a small block after the word 'Diagnosis:'
    if not fields["diagnosis"]:
        m = re.search(r"Diagnosis\s*[:\-]\s*(.+?)(?:\n\s*\n|$)", raw_text, re.IGNORECASE | re.DOTALL)
        if m:
            fields["diagnosis"] = m.group(1).strip()

    # --- Medications (improved heuristics) ---
    meds = []
    med_pattern = re.compile(r"([A-Z][a-zA-Z\-]{2,}(?:\s+[A-Z][a-zA-Z\-]*)?\s+\d+\s*(?:mg|g|ml|mcg|IU)\b)", re.IGNORECASE)

    # 1) Look for a labeled medications block and split on common separators and bullets
    m_block = re.search(r"(?:Medications?|Prescription|Treatment Plan|Rx)\s*[:\-]\s*(.+?)(?:\n\s*\n|$)", raw_text, re.IGNORECASE | re.DOTALL)
    if m_block:
        block = m_block.group(1)
        # Split on newlines, semicolons, or commas when they likely separate meds
        lines = re.split(r"\n|;|\u2022|\\u2022", block)
        for line in lines:
            line = line.strip(' \t\u2022\u2023\u2024\u25E6')
            if not line:
                continue
            # If the line contains comma-separated items, split further
            parts = [p.strip() for p in re.split(r",\s*(?=[A-Za-z])", line) if p.strip()]
            meds.extend(parts)

    # 2) If no block, fallback to scanning sentences for drug+dosage patterns or medication keywords
    if not meds:
        for sent in doc.sents:
            text = sent.text.strip()
            if med_pattern.search(text):
                meds.append(text)
                continue
            if any(keyword in text.lower() for keyword in ["tablet", "capsule", "mg", "dose", "medicine", "take", "tab", "once daily", "twice daily"]):
                # Try to extract comma-separated items from sentence
                parts = [p.strip() for p in re.split(r",\s*(?=[A-Za-z])", text) if p.strip()]
                meds.extend(parts)

    # Normalize, extract primary drug tokens and dedupe
    if meds:
        normalized = []
        seen = set()
        for s in meds:
            s_clean = re.sub(r"\s+", " ", s).strip()
            m2 = med_pattern.search(s_clean)
            token = m2.group(1).strip() if m2 else s_clean
            # shorten long tokens to first 6 words
            token_short = ' '.join(token.split()[:6])
            key = token_short.lower()
            if key not in seen:
                normalized.append(token_short)
                seen.add(key)
        fields["medications"] = "; ".join(normalized)

    return fields


def preprocess_image(image_path):
    """Run a set of OpenCV transforms to improve OCR: grayscale, denoise, adaptive threshold, and enlarge."""
    img = cv2.imread(image_path)
    if img is None:
        return image_path

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    # Denoise
    denoised = cv2.fastNlMeansDenoising(gray, None, h=10)
    # Resize slightly to help Tesseract
    h, w = denoised.shape
    scale = 1.5 if max(w, h) < 2000 else 1.0
    if scale != 1.0:
        denoised = cv2.resize(denoised, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_CUBIC)
    # Adaptive threshold
    thresh = cv2.adaptiveThreshold(denoised, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 31, 15)

    # Morphological close to join characters
    kernel = np.ones((1, 1), np.uint8)
    closed = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel)

    out_path = os.path.join(os.path.dirname(image_path), f"proc_{os.path.basename(image_path)}")
    cv2.imwrite(out_path, closed)
    return out_path

# Flask app
app = Flask(__name__)
CORS(app)
UPLOAD_FOLDER = "uploads"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

@app.route("/api/ocr/extract-text", methods=["POST"])
def extract_text():
    if "file" not in request.files:
        return jsonify({"success": False, "error": "No file uploaded"}), 400
    file = request.files["file"]
    filepath = os.path.join(UPLOAD_FOLDER, file.filename)
    file.save(filepath)
    text = file_to_text(filepath)
    return jsonify({"success": True, "raw_text": text})

@app.route("/api/ocr/extract-fields", methods=["POST"])
def extract_fields():
    if "file" not in request.files:
        return jsonify({"success": False, "error": "No file uploaded"}), 400
    file = request.files["file"]
    filepath = os.path.join(UPLOAD_FOLDER, file.filename)
    file.save(filepath)
    # Run OCR (with preprocessing) and compute confidences
    text = file_to_text(filepath)
    avg_conf, token_conf = compute_confidences(filepath)

    # Prefer the enhanced parser (regex + spaCy heuristics) when available
    if parse_fields_enhanced:
        try:
            fields = parse_fields_enhanced(text)
        except Exception:
            # fallback
            fields = parse_fields_with_spacy(text)
    else:
        fields = parse_fields_with_spacy(text)

    # Build simple per-field confidence heuristics
    # Smarten up per-field confidence using token confidences and presence
    def estimate_field_confidence(field_value, keywords=[]):
        if not field_value:
            return 20
        # boost if many tokens had good confidence
        matches = [conf for tok, conf in token_conf if tok.lower() in str(field_value).lower()]
        avg_match = int(statistics.mean(matches)) if matches else avg_conf
        # clamp
        return max(30, min(95, int((avg_match * 0.8) + (90 if field_value else 0) * 0.2)))

    # Expand confidences for vitals and patient id
    confidence = {
        "overall": avg_conf,
        "patient_name": estimate_field_confidence(fields.get("patient_name")),
        "patient_id": estimate_field_confidence(fields.get("patient_id")),
        "age": estimate_field_confidence(fields.get("age")),
        "sex": estimate_field_confidence(fields.get("sex")),
        "diagnosis": estimate_field_confidence(fields.get("diagnosis")),
        "medications": estimate_field_confidence(fields.get("medications")),
        "blood_pressure": estimate_field_confidence(fields.get("blood_pressure")),
        "weight": estimate_field_confidence(fields.get("weight")),
        "height": estimate_field_confidence(fields.get("height")),
        "temperature": estimate_field_confidence(fields.get("temperature")),
    }

    notes = []
    if confidence["overall"] < 50:
        notes.append("Low overall OCR confidence; consider retaking image with better lighting/contrast")

    return jsonify({"success": True, "fields": fields, "confidence": confidence, "notes": notes, "raw_text": text})

if __name__ == "__main__":
    app.run(port=3002, debug=True)
