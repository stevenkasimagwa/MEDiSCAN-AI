"""Utilities to parse free-text OCR medical records.

Provides:
- parse_medical_record(text): returns dict with keys: name, age, sex, diagnosis, blood_pressure, weight, prescription

Notes:
- Uses spaCy for light-weight sentence/entity parsing and regex for structured fields.
- Install with: `pip install -r requirements.txt` and download the model:
    python -m spacy download en_core_web_sm
"""
from typing import Optional, Dict
import re
# load model lazily
_NLP = None

def _get_nlp():
    global _NLP
    if _NLP is None:
        try:
            import importlib
            spacy = importlib.import_module('spacy')
            _NLP = spacy.load('en_core_web_sm')
        except Exception:
            # propagate a helpful error
            raise RuntimeError("spaCy model 'en_core_web_sm' not available. Run: python -m spacy download en_core_web_sm")
    return _NLP


def _extract_name(text: str, nlp) -> Optional[str]:
    # Prefer explicit "Name: ..." patterns
    m = re.search(r"\bName[:\s]+([A-Z][A-Za-z ,.'-]{1,80})", text)
    if m:
        return m.group(1).strip()

    doc = nlp(text)
    # Use first PERSON entity if any
    for ent in doc.ents:
        if ent.label_ == 'PERSON':
            return ent.text.strip()
    return None


def _extract_age(text: str) -> Optional[int]:
    patterns = [
        r"\bAge[:\s]*([0-9]{1,3})\b",
        r"\b([0-9]{1,3})\s*(?:years|yrs|y/o|yo|years old)\b",
        r"\b([0-9]{1,3})[- ]?y\b",
    ]
    for p in patterns:
        m = re.search(p, text, flags=re.IGNORECASE)
        if m:
            try:
                return int(m.group(1))
            except Exception:
                continue
    return None


def _extract_sex(text: str) -> Optional[str]:
    m = re.search(r"\b(Sex|Gender)[:\s]*([MFmf]|Male|Female|male|female)\b", text)
    if m:
        raw = m.group(2)
    else:
        m2 = re.search(r"\b(Male|Female|M|F)\b", text)
        raw = m2.group(1) if m2 else None
    if not raw:
        return None
    raw = raw.strip().lower()
    if raw in ('m', 'male'):
        return 'male'
    if raw in ('f', 'female'):
        return 'female'
    return None


def _extract_blood_pressure(text: str) -> Optional[str]:
    # handle many common patterns like:
    # BP: 120/80, BP - 120 / 80 mmHg, Blood Pressure 120 over 80, 120/80 mmHg, 120 over 80
    patterns = [
        r"\b(?:BP|B\.P\.|Blood Pressure|Blood-Pressure)[:\s\-]*([0-9]{2,3}\s*/\s*[0-9]{2,3})(?:\s*mmHg)?\b",
        r"\b(?:BP|B\.P\.|Blood Pressure)[:\s\-]*([0-9]{2,3})\s*(?:over|/)\s*([0-9]{2,3})(?:\s*mmHg)?\b",
        r"\b([0-9]{2,3})\s*(?:over)\s*([0-9]{2,3})\s*(?:mmHg)?\b",
        r"\b([0-9]{2,3}\s*/\s*[0-9]{2,3})\s*(?:mmHg)?\b",
    ]
    for p in patterns:
        m = re.search(p, text, flags=re.IGNORECASE)
        if m:
            if m.lastindex and m.lastindex >= 2 and m.group(2):
                # pattern with two capture groups (systolic, diastolic)
                s = m.group(1)
                d = m.group(2)
                s_clean = re.sub(r"\s+", "", s)
                d_clean = re.sub(r"\s+", "", d)
                return f"{s_clean}/{d_clean}"
            else:
                return re.sub(r"\s+", "", m.group(1))
    return None


def _extract_weight(text: str) -> Optional[str]:
    # captures kg, kgs, kilograms, lb, lbs, pounds
    # handle 'Weight:68kg', 'Wt: 68 kg', 'Weight - 150 lbs'
    m = re.search(r"\b(?:Weight|Wt|Wt\.|Wt:)[:\s\-]*([0-9]{1,3}(?:\.[0-9])?)\s*(kg|kgs|kilograms|lb|lbs|pounds)?\b", text, flags=re.IGNORECASE)
    if m:
        num = m.group(1)
        unit = m.group(2) or ''
        unit = unit.strip().lower()
        unit = unit if unit else 'kg' if float(num) < 200 else ''
        out = f"{num} {unit}".strip()
        return out
    # fallback: generic pattern
    m2 = re.search(r"\b([0-9]{1,3}(?:\.[0-9])?)\s*(kg|kgs|kilograms|lb|lbs|pounds)\b", text, flags=re.IGNORECASE)
    if m2:
        return f"{m2.group(1)} {m2.group(2)}".lower()
    return None


def _extract_prescription(text: str, nlp) -> Optional[str]:
    # Look for explicit Prescription or Rx lines
    m = re.search(r"\b(?:Rx|Prescription)[:\s]*([\s\S]{1,200})", text, flags=re.IGNORECASE)
    if m:
        # cut at newline if present
        return m.group(1).split('\n')[0].strip()

    # fallback: look for sentences with 'tablet', 'mg', 'take', 'capsule', 'dose'
    doc = nlp(text)
    for sent in doc.sents:
        s = sent.text.lower()
        if any(k in s for k in ('tablet', 'tab', 'mg', 'take', 'capsule', 'dose', 'daily', 'once', 'twice', 'bd')):
            return sent.text.strip()
    return None


def _extract_diagnosis(text: str, nlp) -> Optional[str]:
    # Prefer lines/sentences containing diagnosis-like keywords
    diag_keywords = ('diagnos', 'impression', 'assessment', 'plan', 'dx', 'finding', 'conclusion')
    doc = nlp(text)
    # 1) explicit keyword sentences
    for sent in doc.sents:
        if any(k in sent.text.lower() for k in diag_keywords):
            return sent.text.strip()

    # 2) heuristics: look for sentences containing likely medical terms
    medical_terms = ('fever', 'infection', 'pain', 'fracture', 'hypertension', 'diabetes', 'cough', 'pneumonia', 'asthma')
    for sent in doc.sents:
        if any(t in sent.text.lower() for t in medical_terms):
            return sent.text.strip()

    # 3) fallback: return the first reasonably short sentence that contains more than 3 tokens
    for sent in doc.sents:
        if len([t for t in sent if not t.is_punct]) >= 3:
            return sent.text.strip()

    return None


def parse_medical_record(text: str) -> Dict[str, Optional[str]]:
    """Parse a raw OCR text and extract common medical-record fields.

    Returns a dict with keys: name, age, sex, diagnosis, blood_pressure, weight, prescription.
    Missing fields are None.
    """
    nlp = _get_nlp()
    # Normalize whitespace
    txt = re.sub(r"\r\n|\r", "\n", text or "")

    try:
        name = _extract_name(txt, nlp)
        age = _extract_age(txt)
        sex = _extract_sex(txt)
        blood_pressure = _extract_blood_pressure(txt)
        weight = _extract_weight(txt)
        prescription = _extract_prescription(txt, nlp)
        diagnosis = _extract_diagnosis(txt, nlp)

        return {
            'name': name,
            'age': age,
            'sex': sex,
            'diagnosis': diagnosis,
            'blood_pressure': blood_pressure,
            'weight': weight,
            'prescription': prescription,
        }
    except Exception as e:
        # In case spaCy model not installed or other errors, return None fields but surface the error
        raise


def parse_medical_record_quick(text: str):
    """Quick regex-only fallback parser that returns the same dict but without spaCy.

    This is for demo purposes when spaCy isn't installed yet.
    """
    bp = _extract_blood_pressure(text)
    age = _extract_age(text)
    name = None
    m = re.search(r"\bName[:\s]+([A-Z][A-Za-z ,.'-]{1,80})", text)
    if m:
        name = m.group(1).strip()
    sex = _extract_sex(text)
    weight = _extract_weight(text)
    # diagnosis: naive: look after 'Diagnosis' or first line with medical words
    mdiag = re.search(r"(?:Diagnosis|Dx|Impression)[:\s]*([\s\S]{1,200})", text, flags=re.IGNORECASE)
    diagnosis = mdiag.group(1).split('\n')[0].strip() if mdiag else None
    mpres = re.search(r"(?:Rx|Prescription)[:\s]*([\s\S]{1,200})", text, flags=re.IGNORECASE)
    prescription = mpres.group(1).split('\n')[0].strip() if mpres else None
    return {
        'name': name,
        'age': age,
        'sex': sex,
        'diagnosis': diagnosis,
        'blood_pressure': bp,
        'weight': weight,
        'prescription': prescription,
    }


if __name__ == '__main__':
    sample = '''
    Name: John Doe
    Age: 45 years
    Sex: Male
    Complaint: cough and fever for 3 days.
    Diagnosis: Acute bronchitis.
    BP: 120/80 mmHg
    Weight: 70 kg
    Rx: Amoxicillin 500mg TDS for 7 days, Paracetamol 500 mg as needed
    '''

    print('Quick regex-only parse result:')
    print(parse_medical_record_quick(sample))
