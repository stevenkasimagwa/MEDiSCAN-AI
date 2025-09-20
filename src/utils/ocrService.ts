import Tesseract from 'tesseract.js';

export interface ExtractedFields {
  patientName: string;
  age: string;
  gender: string;
  date: string;
  diagnosis: string;
  prescription: string;
}

export class OCRService {
  static async extractText(imageFile: File): Promise<string> {
    try {
      const result = await Tesseract.recognize(imageFile, 'eng', {
        logger: m => console.log(m)
      });
      
      // Post-process for medical handwriting
      let text = result.data.text;
      
      // Common OCR corrections for medical handwriting
      const corrections = {
        'l': 'I', // lowercase l often mistaken for I
        'rn': 'm', // rn combination often mistaken for m
        'vv': 'w', // double v for w
        '6': 'G', // 6 often mistaken for G in handwriting
        '0': 'O', // 0 often mistaken for O
        '5': 'S', // 5 often mistaken for S
        'ii': 'n', // double i for n
        'cl': 'd', // cl combination for d
      };
      
      // Apply corrections while preserving word boundaries
      for (const [wrong, correct] of Object.entries(corrections)) {
        const regex = new RegExp(`\\b${wrong}\\b`, 'gi');
        text = text.replace(regex, correct);
      }
      
      return text;
    } catch (error) {
      console.error('OCR Error:', error);
      throw new Error('Failed to extract text from image');
    }
  }

  static extractFields(text: string): ExtractedFields {
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    
    const fields: ExtractedFields = {
      patientName: '',
      age: '',
      gender: '',
      date: '',
      diagnosis: '',
      prescription: ''
    };

    // Enhanced pattern matching for medical records with fuzzy matching
    const patterns = {
      name: /(?:name|patient|pt|mr|mrs|miss|dr)[:\s]*([a-zA-Z\s.'-]+)/i,
      age: /(?:age|yrs?|years?|y\/o|born)[:\s]*(\d{1,3}|[1-9]\d?)/i,
      gender: /(?:gender|sex|male|female|m\/f|patient)[:\s]*(male|female|m|f|man|woman)/i,
      date: /(?:date|visit|seen|examined|today)[:\s]*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
      diagnosis: /(?:diagnosis|dx|condition|problem|complain|chief|complaint|presenting)[:\s]*([^,\n\r]+)/i,
      prescription: /(?:prescription|rx|medication|medicine|drug|treatment|advised|prescribed)[:\s]*([^,\n\r]+)/i
    };

    // Extract using patterns
    for (const line of lines) {
      if (!fields.patientName && patterns.name.test(line)) {
        const match = line.match(patterns.name);
        if (match) fields.patientName = match[1].trim();
      }
      
      if (!fields.age && patterns.age.test(line)) {
        const match = line.match(patterns.age);
        if (match) fields.age = match[1].trim();
      }
      
      if (!fields.gender && patterns.gender.test(line)) {
        const match = line.match(patterns.gender);
        if (match) {
          const g = match[1].toLowerCase();
          fields.gender = g === 'm' || g === 'male' ? 'Male' : 'Female';
        }
      }
      
      if (!fields.date && patterns.date.test(line)) {
        const match = line.match(patterns.date);
        if (match) fields.date = match[1].trim();
      }
      
      if (!fields.diagnosis && patterns.diagnosis.test(line)) {
        const match = line.match(patterns.diagnosis);
        if (match) fields.diagnosis = match[1].trim();
      }
      
      if (!fields.prescription && patterns.prescription.test(line)) {
        const match = line.match(patterns.prescription);
        if (match) fields.prescription = match[1].trim();
      }
    }

    // Fallback: try to extract from unstructured text
    if (!fields.patientName) {
      // Look for names (capitalized words)
      const nameMatch = text.match(/[A-Z][a-z]+ [A-Z][a-z]+/);
      if (nameMatch) fields.patientName = nameMatch[0];
    }

    if (!fields.age) {
      // Look for standalone numbers that could be age
      const ageMatch = text.match(/\b([1-9]\d?|100)\b/);
      if (ageMatch) fields.age = ageMatch[1];
    }

    return fields;
  }

  static generatePatientId(patientName: string): string {
    const timestamp = Date.now().toString().slice(-6);
    const namePrefix = patientName.replace(/\s+/g, '').slice(0, 3).toUpperCase();
    return `${namePrefix}${timestamp}`;
  }
}