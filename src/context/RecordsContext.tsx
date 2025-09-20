import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { apiService } from '@/services/apiService';
import { useAuth } from '@/hooks/useAuth';

type MedicalRecord = any;

interface RecordsContextShape {
  records: MedicalRecord[];
  fetchRecords: (q?: string) => Promise<void>;
  searchRecords: (q: string) => Promise<void>;
  searchTerm: string;
  setSearchTerm: (v: string) => void;
  loading: boolean;
}

const RecordsContext = createContext<RecordsContextShape | undefined>(undefined);

export const RecordsProvider: React.FC<React.PropsWithChildren<{}>> = ({ children }) => {
  const { user } = useAuth();
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);

  // track global in-flight + per-query in-flight to avoid duplicate requests
  const inFlightRef = useRef(false);
  const lastFetchRef = useRef<number | null>(null);
  const inFlightByQueryRef = useRef<Record<string, Promise<any> | null>>({});
  const lastFetchByQueryRef = useRef<Record<string, number | null>>({});

  const fetchRecords = useCallback(async (q?: string) => {
    // prevent overlapping fetches which can cause infinite loops if callers re-trigger on each change
    const now = Date.now();
    const key = q ?? '__all__';

    // If last fetch for this query was recent (within 3s), skip
    const lastForKey = lastFetchByQueryRef.current[key];
    if (lastForKey && now - lastForKey < 3000) {
      console.debug(`[RecordsContext] Skipping fetch for '${key}'; last fetch too recent`);
      return;
    }

    // if there's already an in-flight promise for this query, reuse it
    if (inFlightByQueryRef.current[key]) {
      console.debug(`[RecordsContext] Reusing in-flight fetch for '${key}'`);
      try {
        await inFlightByQueryRef.current[key];
      } catch (e) {
        // swallow - the original fetch handled errors
      }
      return;
    }

    inFlightRef.current = true;
    setLoading(true);
    try {
      console.debug('[RecordsContext] Fetching records...', { q });
      const promise = apiService.getMedicalRecords(q);
      inFlightByQueryRef.current[key] = promise;
      const data = await promise;
      // apiService may return { records: [...] } or an array
      const rawArray = Array.isArray(data) ? data : (data && Array.isArray((data as any).records) ? (data as any).records : []);

      // helper: convert various timestamp formats to ISO string
      const toISO = (val: any): string => {
        if (val == null) return '';
        // numbers (seconds or milliseconds)
        if (typeof val === 'number' && Number.isFinite(val)) {
          // seconds (10 digits) -> milliseconds
          if (val.toString().length <= 10) val = val * 1000;
          const d = new Date(val);
          return Number.isNaN(d.getTime()) ? '' : d.toISOString();
        }
        // numeric strings
        if (typeof val === 'string' && /^\d+$/.test(val)) {
          const n = Number(val);
          if (!Number.isNaN(n)) {
            if (val.length <= 10) return new Date(n * 1000).toISOString();
            return new Date(n).toISOString();
          }
        }
        // ISO-like strings
        if (typeof val === 'string') {
          const d = new Date(val);
          return Number.isNaN(d.getTime()) ? '' : d.toISOString();
        }
        return '';
      };

      // helper: get YYYY-MM-DD from any date-like value
      const toISODate = (val: any): string => {
        const iso = toISO(val);
        if (!iso) return '';
        return iso.split('T')[0];
      };

      // Normalize records to expected shape for UI components
      const normalized = (rawArray as any[]).map(r => {
        const createdAt = toISO(r.created_at ?? r.createdAt ?? r.date ?? r.timestamp ?? r.ts);
        const dateRecorded = toISODate(r.date_recorded ?? r.date ?? r.created_at ?? r.createdAt ?? r.timestamp ?? r.ts);

        // raw extracted text (OCR) may contain a diagnosis in many formats; if no explicit
        // diagnosis/impression is present, try a conservative extraction from raw_text.
        const rawText: string | null = (r.raw_text ?? r.raw ?? r.text ?? null) as any;
        const explicitDiag = (r.diagnosis ?? r.impression ?? r.summary ?? r.notes) as string | undefined;
        let extractedDiag: string | null = null;
        if (!explicitDiag && rawText) {
          // Heuristic: take the first non-empty line and trim to 240 chars
          const firstLine = rawText.split(/\r?\n/).map(s => s.trim()).find(Boolean) || '';
          if (firstLine) extractedDiag = firstLine.slice(0, 240);
        }

        return {
          id: String(r.id ?? r.record_id ?? r._id ?? '') || '',
          patient_name: r.patient_name ?? r.patientName ?? r.name ?? '',
          // Be conservative when choosing a patient identifier — avoid falling back to patient name
          patient_id: String(r.patient_id ?? r.patientId ?? r.patient_identifier ?? r.national_id ?? '') || '',
          doctor_name: r.doctor_name ?? r.doctorName ?? r.doctor ?? r.doctor_username ?? '',
          // Prefer explicit diagnosis fields; fall back to a short extraction from raw_text when needed
          diagnosis: String(explicitDiag ?? extractedDiag ?? '') || '',
          // Indicate when the diagnosis was taken from extracted OCR text
          diagnosis_is_extracted: Boolean(!explicitDiag && !!extractedDiag),
          // medications / prescription - keep separately so UI can display them
          medications: r.medications ?? r.prescription ?? r.medication_list ?? null,
          // date fields: keep both a date-only `date_recorded` (YYYY-MM-DD) and full `created_at` ISO
          date_recorded: dateRecorded,
          created_at: createdAt,
          age: r.age ?? r.patient_age ?? null,
          sex: r.sex ?? r.gender ?? r.patient_sex ?? null,
          image_url: r.image_url ?? r.imageUrl ?? r.file_url ?? null,
          raw_text: rawText,
          status: r.status ?? 'completed',
          // keep original raw payload for debugging if needed
          _raw: r
        } as MedicalRecord;
      });

      // Replace records with normalized server response for this query
      setRecords(normalized);
      lastFetchByQueryRef.current[key] = Date.now();
    } catch (err) {
      console.error('Failed to fetch records from context', err);
      setRecords([]);
    } finally {
      setLoading(false);
      inFlightRef.current = false;
      // clear in-flight for this query
      const key = q ?? '__all__';
      inFlightByQueryRef.current[key] = null;
    }
  }, []);

  const searchRecords = useCallback(async (q: string) => {
    setSearchTerm(q);
    await fetchRecords(q);
  }, [fetchRecords]);

  useEffect(() => {
    // initial load with no query
    fetchRecords();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  return (
    <RecordsContext.Provider value={{ records, fetchRecords, searchTerm, setSearchTerm, loading, searchRecords }}>
      {children}
    </RecordsContext.Provider>
  );
};

export const useRecords = () => {
  const ctx = useContext(RecordsContext);
  if (!ctx) throw new Error('useRecords must be used within RecordsProvider');
  return ctx;
};

export default RecordsContext;
