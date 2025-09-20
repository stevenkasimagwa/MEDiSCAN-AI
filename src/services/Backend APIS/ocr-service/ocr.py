import os
from PIL import Image
import pytesseract
from pdf2image import convert_from_path
import tempfile

def set_tesseract_cmd(path):
    if path:
        pytesseract.pytesseract.tesseract_cmd = path

def image_to_text(image_path, lang='eng'):
    """
    Run tesseract on a single image file and return extracted text.
    """
    text = pytesseract.image_to_string(Image.open(image_path), lang=lang)
    return text

def pdf_to_text(pdf_path, lang='eng'):
    """
    Convert PDF pages to images and OCR each page (basic).
    Requires poppler (pdf2image dependency).
    """
    pages = convert_from_path(pdf_path)
    all_text = []
    for page in pages:
        # save page to temp PNG and OCR
        with tempfile.NamedTemporaryFile(suffix='.png', delete=True) as tmpf:
            page.save(tmpf.name, 'PNG')
            txt = pytesseract.image_to_string(Image.open(tmpf.name), lang=lang)
            all_text.append(txt)
    return "\n\n".join(all_text)

def file_to_text(filepath, lang='eng'):
    """
    Detect file type by extension and run appropriate OCR.
    """
    ext = os.path.splitext(filepath)[1].lower()
    if ext in ['.png', '.jpg', '.jpeg', '.tiff', '.bmp']:
        return image_to_text(filepath, lang=lang)
    elif ext == '.pdf':
        return pdf_to_text(filepath, lang=lang)
    else:
        # Fallback: try opening with PIL (may fail)
        try:
            return image_to_text(filepath, lang=lang)
        except Exception as e:
            raise ValueError(f"Unsupported file type: {ext}") from e
