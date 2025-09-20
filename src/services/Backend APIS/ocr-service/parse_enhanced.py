"""Enhanced regex + spaCy-assisted parser for OCR medical records.

This module provides `parse_fields_enhanced(text, token_confidences=None)` which returns a dict with keys:
 patient_name, patient_id, age, sex, diagnosis, medications, blood_pressure, weight, height, temperature, raw_text

It aims to be robust to common OCR noise, supports unit normalization, and accepts optional token-level confidences
to bias parsing toward higher-confidence tokens.
"""
from typing import Optional, Dict, List, Tuple
import re
import math

_NLP = None


def _load_spacy() -> Optional[object]:
    """Lazily load spaCy model when needed. Returns model or None on failure."""
    global _NLP
    if _NLP is not None:
        return _NLP
    try:
        import spacy
        _NLP = spacy.load('en_core_web_sm')
        return _NLP
    except Exception:
        _NLP = None
        return None


def _normalize_ocr_noise(s: str) -> str:
    if not s:
        return ''
    # common OCR substitutions
    s = s.replace('\r\n', '\n')
    s = s.replace('\t', ' ')
    s = re.sub(r'[_\|]{2,}', '-', s)
    # replace weird unicode dashes with ascii
    s = re.sub('[–—−]', '-', s)
    # remove repeated whitespace
    s = re.sub(r'\s+', ' ', s)
    return s.strip()


def _lines(text: str) -> List[str]:
    clean = _normalize_ocr_noise(text or '')
    return [l.strip() for l in clean.splitlines() if l.strip()]


def _find_label_value(lines: List[str], labels: List[str]) -> Optional[str]:
    pattern = re.compile(r"(?:" + "|".join([re.escape(l) for l in labels]) + r")\s*[:\-]?\s*(.+)", flags=re.IGNORECASE)
    for ln in lines:
        m = pattern.search(ln)
        if m:
            return m.group(1).strip()
    return None


def _normalize_patient_id(raw: str) -> Optional[str]:
    if not raw:
        return None
    raw = raw.strip()
    # prefer 'PID-12345' or 'MRN-12345' normalized
    m = re.search(r"(PID|MRN|ID)[\s:\-]*([A-Za-z0-9\-]+)", raw, flags=re.IGNORECASE)
    if m:
        return f"{m.group(1).upper()}-{m.group(2).upper()}"
    # otherwise collapse non-alphanum and return uppercase token if reasonable length
    compact = re.sub(r"[^A-Za-z0-9]", '', raw)
    if 4 <= len(compact) <= 20:
        return compact.upper()
    return None


def _extract_patient_id(lines: List[str]) -> Optional[str]:
    val = _find_label_value(lines, ['Patient ID', 'PatientID', 'MRN', 'ID', 'PID', 'Hospital No', 'HNo', 'Record No'])
    if val:
        return _normalize_patient_id(val)

    # fallback: look for patterns like PID-12345 or MRN tokens or long allcaps tokens
    for ln in lines:
        m = re.search(r"\b(PID[-\s]?\d{3,}|MRN[-\s]?\d{3,}|[A-Z0-9]{6,12})\b", ln)
        if m:
            return _normalize_patient_id(m.group(1))
    return None


def _extract_vital_regex(text: str, patterns: List[str]) -> Optional[str]:
    for p in patterns:
        m = re.search(p, text, flags=re.IGNORECASE)
        if m:
            groups = [g for g in m.groups() if g]
            if groups:
                if len(groups) > 1 and all(re.search(r"^\d", g) for g in groups):
                    return "/".join([re.sub(r"\s+", "", g) for g in groups])
                return groups[0]
            return m.group(0).strip()
    return None


def _convert_lb_to_kg(val: float) -> float:
    return round(val * 0.45359237, 2)


def _extract_weight(text: str) -> Optional[str]:
    # 1) Prefer explicitly labeled weight (Weight, Wt)
    m = re.search(r"\b(?:Weight|Wt|Wt\.|Wt:)\s*[:\-]?\s*([0-9]{1,3}(?:\.[0-9]+)?)\s*(kg|kgs|kilograms|lb|lbs|pounds)?\b", text, flags=re.IGNORECASE)
    if m:
        num = float(m.group(1))
        unit = (m.group(2) or '').strip().lower()
        if unit in ('lb', 'lbs', 'pounds'):
            kg = _convert_lb_to_kg(num)
            return f"{kg} kg"
        if not unit:
            return f"{num} kg"
        return f"{num} {unit}"

    # 2) Look for explicit kg mentions elsewhere
    m2 = re.search(r"\b([0-9]{1,3}(?:\.[0-9]+)?)\s*(kg|kgs)\b", text, flags=re.IGNORECASE)
    if m2:
        num = float(m2.group(1))
        return f"{num} kg"

    # 3) Look for lbs mention
    m3 = re.search(r"\b([0-9]{2,3}(?:\.[0-9]+)?)\s*(lb|lbs|pounds)\b", text, flags=re.IGNORECASE)
    if m3:
        num = float(m3.group(1))
        kg = _convert_lb_to_kg(num)
        return f"{kg} kg"

    return None


def _extract_height(text: str) -> Optional[str]:
    # Accept cm, m, or feet/inches
    patterns = [
        r"\bHeight[:\s\-]*([0-9]{2,3})\s*(cm|cm\.|centimeters)?\b",
        r"\b([0-9]{1,2})\s*ft\s*([0-9]{1,2})?\s*(?:in|inches)?\b",
        r"\b([0-9]{2,3})\s*cm\b",
    ]
    for p in patterns:
        m = re.search(p, text, flags=re.IGNORECASE)
        if m:
            if len(m.groups()) >= 2 and m.group(2) and re.search(r"cm", (m.group(2) or ''), re.IGNORECASE):
                return f"{m.group(1)} cm"
            if len(m.groups()) >= 2 and m.group(2) is not None and re.match(r"^\d+$", m.group(1)):
                # feet & optionally inches -> convert to cm
                ft = int(m.group(1))
                inches = int(m.group(2)) if m.group(2) and m.group(2).isdigit() else 0
                total_cm = round((ft * 12 + inches) * 2.54)
                return f"{total_cm} cm"
            return m.group(1)
    return None


def _extract_temperature(text: str) -> Optional[str]:
    m = re.search(r"\bTemp(?:erature)?[:\s\-]*([0-9]{2,3}(?:\.[0-9]+)?)\s*(C|F|c|f|deg|°)?\b", text, flags=re.IGNORECASE)
    if m:
        val = float(m.group(1))
        unit = (m.group(2) or 'C').upper()
        if unit == 'F' or (unit == 'C' and val > 60):
            # if only number and >60 assume Fahrenheit -> convert to C
            if unit == 'F' or val > 60:
                c = round((val - 32) * (5.0/9.0), 1)
                return f"{c} C"
        return f"{val} {unit}"
    # fallback patterns like 37.5 C or 98.6F
    m2 = re.search(r"\b([0-9]{2,3}(?:\.[0-9]+)?)\s*(?:°|deg)?\s*(C|F)\b", text, flags=re.IGNORECASE)
    if m2:
        val = float(m2.group(1))
        unit = m2.group(2).upper()
        if unit == 'F':
            c = round((val - 32) * (5.0/9.0), 1)
            return f"{c} C"
        return f"{val} C"
    return None


def _extract_bp(text: str) -> Optional[str]:
    patterns = [
        r"\b(?:BP|B\.P\.|Blood Pressure)[:\s\-]*([0-9]{2,3})\s*/\s*([0-9]{2,3})\b",
        r"\b([0-9]{2,3})\s*over\s*([0-9]{2,3})\b",
        r"\b([0-9]{2,3})\s*[/:]\s*([0-9]{2,3})\b",
    ]
    return _extract_vital_regex(text, patterns)


def _extract_age(text: str) -> Optional[str]:
    m = re.search(r"\bAge[:\s\-]*([0-9]{1,3})\b", text, flags=re.IGNORECASE)
    if m:
        return str(int(m.group(1)))
    m2 = re.search(r"\b([0-9]{1,3})\s*(?:years|yrs|y/o|yo)\b", text, flags=re.IGNORECASE)
    if m2:
        return str(int(m2.group(1)))
    return None


def _extract_sex(text: str) -> Optional[str]:
    m = re.search(r"\b(Sex|Gender)[:\s]*([MFmf]|Male|Female|male|female)\b", text)
    if m:
        val = m.group(2).strip().lower()
        if val.startswith('m'):
            return 'male'
        if val.startswith('f'):
            return 'female'
    m2 = re.search(r"\b(Male|Female|M|F)\b", text, flags=re.IGNORECASE)
    if m2:
        v = m2.group(1).strip().lower()
        return 'male' if v.startswith('m') else 'female'
    return None


def _extract_name_via_spacy(text: str) -> Optional[str]:
    nlp = _load_spacy()
    if not nlp:
        return None
    doc = nlp(text)
    # prefer the longest PERSON entity (but not too long)
    best = None
    for ent in doc.ents:
        if ent.label_ == 'PERSON':
            t = ent.text.strip()
            words = len(t.split())
            if 1 < words <= 6:
                if not best or len(t) > len(best):
                    best = t
    return best


def _extract_medications(lines: List[str], text: str) -> Optional[str]:
    # Look for labeled Rx/Medications block
    block = _find_label_value(lines, ['Medications', 'Medication', 'Rx', 'Prescription', 'Treatment Plan'])
    meds = []
    if block:
        parts = re.split(r"\n|;|,\s*(?=[A-Za-z])", block)
        for p in parts:
            s = p.strip(' \u2022\u2023\u2024\u25E6')
            if not s:
                continue
            meds.append(s)
    else:
        # scan sentences for dosage patterns or common med separators
        for m in re.finditer(r"([A-Za-z][A-Za-z0-9\-\(\)]+\s+\d+\s*(?:mg|g|ml|mcg|IU))", text, flags=re.IGNORECASE):
            meds.append(m.group(1))
        if not meds:
            # try to find lines that start with common bullet markers or 'Rx'
            for ln in lines:
                if ln.lower().startswith('rx') or ln.lower().startswith('prescription') or re.search(r"\d+\s*(?:mg|ml|g)", ln):
                    meds.append(ln)
    if meds:
        normalized = []
        seen = set()
        for s in meds:
            s_clean = re.sub(r"\s+", " ", s).strip()
            key = s_clean.lower()
            if key not in seen:
                seen.add(key)
                normalized.append(s_clean)
        return '; '.join(normalized)
    return None


def parse_fields_enhanced(text: str, token_confidences: Optional[List[Tuple[str, int]]] = None) -> Dict[str, Optional[str]]:
    txt = text or ''
    lines = _lines(txt)
    fields = {
        'patient_name': None,
        'patient_id': None,
        'age': None,
        'sex': None,
        'diagnosis': None,
        'medications': None,
        'blood_pressure': None,
        'weight': None,
        'height': None,
        'temperature': None,
        'raw_text': txt,
    }

    # Patient ID
    fields['patient_id'] = _extract_patient_id(lines)

    # Name: prefer labeled name, then spaCy NER
    name_label = _find_label_value(lines, ['Full Name', 'Patient Name', 'Name'])
    if name_label:
        fields['patient_name'] = name_label.split('\n')[0].strip()
    else:
        sp = _extract_name_via_spacy(txt)
        if sp:
            fields['patient_name'] = sp

    # Numeric fields
    fields['age'] = _extract_age(txt)
    fields['sex'] = _extract_sex(txt)
    fields['blood_pressure'] = _extract_bp(txt)
    fields['weight'] = _extract_weight(txt)  # normalized to kg when possible
    fields['height'] = _extract_height(txt)  # normalized to cm when possible
    fields['temperature'] = _extract_temperature(txt)

    # Diagnosis: look for labeled sections
    diag = _find_label_value(lines, ['Diagnosis', 'Impression', 'Assessment', 'Dx'])
    if diag:
        fields['diagnosis'] = diag.split('\n')[0].strip()
    else:
        med_terms = ('fever','infection','pain','fracture','hypertension','diabetes','cough','pneumonia','asthma')
        for ln in lines:
            if any(t in ln.lower() for t in med_terms) and len(ln.split()) >= 3:
                fields['diagnosis'] = ln.strip(); break

    # Medications
    fields['medications'] = _extract_medications(lines, txt)

    return fields


if __name__ == '__main__':
    s = '''Name: Jane Doe\nAge: 30\nPID: PID-12345\nBP: 120/80 mmHg\nWeight: 68 kg\nDiagnosis: Mild infection\nRx: Amoxicillin 500mg TDS'''
    print(parse_fields_enhanced(s))
