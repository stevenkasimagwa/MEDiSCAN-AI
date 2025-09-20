import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, ArrowLeft, Save } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { CameraCapture } from './CameraCapture';
import { apiService, MedicalRecord, API_BASE_URL } from '@/services/apiService';

interface ScannerProps {
  onCaptureComplete?: (record: MedicalRecord) => void;
  // legacy handler used by older pages: (text, imageUrl)
  onExtracted?: (text: string, imageUrl: string) => void;
  onBack: () => void;
}

export const Scanner = ({ onCaptureComplete, onExtracted, onBack }: ScannerProps) => {
  const { toast } = useToast();
  const [imageUrl, setImageUrl] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);

  const handleCapture = async (blob: Blob) => {
    const url = URL.createObjectURL(blob);
    setImageUrl(url);
    setIsProcessing(true);

    try {
      // Upload the blob once and handle multiple possible response shapes from backend.
      const ocrResult = await apiService.uploadMedicalRecord(blob);
      // main-api may return { success: true, fields } OR { success: false, ocr_error }
      const ok = Boolean(ocrResult && (ocrResult.success || ocrResult.record_id || ocrResult.recordId));
      if (ocrResult && ocrResult.success === false) {
        const message = ocrResult.ocr_error || 'No text detected in image';
        toast({ title: 'OCR Failed', description: message, variant: 'destructive' });
        return;
      }

      if (ok) {
        const fields = ocrResult.fields || ocrResult.data || {};
        const fileUrl = ocrResult.url || ocrResult.file_url || (ocrResult.fields && ocrResult.fields.file_url) || '';
        const absoluteFileUrl = fileUrl && fileUrl.startsWith('http') ? fileUrl : (fileUrl ? `${API_BASE_URL.replace('/api','')}${fileUrl}` : '');

        const record: MedicalRecord = {
          id: ocrResult.record_id || ocrResult.recordId || fields.record_id || '',
          patient_name: fields.patient_name || fields.name || '',
          raw_text: fields.raw_text || fields.text || '',
          diagnosis: fields.diagnosis || null,
          medications: fields.medications || fields.prescription || null,
          patient_id: fields.patient_id || fields.patientId || undefined,
          weight: fields.weight ? Number(fields.weight) : undefined,
          height: fields.height ? Number(fields.height) : undefined,
          temperature: fields.temperature ? Number(fields.temperature) : undefined,
          age: fields.age ? Number(fields.age) : undefined,
          sex: fields.sex || undefined,
          created_at: new Date().toISOString(),
          image_url: absoluteFileUrl || undefined,
        };

        toast({ title: 'OCR Complete', description: 'Medical record extracted successfully' });
        // Prefer the newer onCaptureComplete signature, but fall back to legacy onExtracted if present
        try {
          if (onCaptureComplete) onCaptureComplete(record);
          if (!onCaptureComplete && onExtracted) {
            // Pass the extracted text and the URL returned by the backend (or the blob preview)
            onExtracted(record.raw_text || '', record.image_url || imageUrl);
          }
        } catch (e) {
          console.error('onCapture callback failed', e);
        }
      } else {
        toast({ title: 'Error', description: 'Failed to extract text from image', variant: 'destructive' });
      }
    } catch (err) {
    console.error('OCR upload error', err);
    // Try to surface a helpful message from the thrown error
    const e: any = err || {};
    const message = e.message || 'An unexpected error occurred while processing the image';
    const detail = e.detail ? `: ${e.detail}` : '';
    const trace = e.trace ? `\nTrace:\n${String(e.trace).slice(0,2000)}` : '';
    toast({ title: 'Error', description: `${message}${detail}${trace}`, variant: 'destructive' });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <h2 className="text-2xl font-bold">Scan Medical Record</h2>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Camera Capture</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <CameraCapture onCapture={handleCapture} />
          {isProcessing && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="animate-spin h-4 w-4" />
              Processing image...
            </div>
          )}
        </CardContent>
      </Card>

      {imageUrl && (
        <Card>
          <CardHeader>
            <CardTitle>Preview</CardTitle>
          </CardHeader>
          <CardContent>
            <img
              src={imageUrl}
              alt="Captured"
              className="max-w-full h-48 object-contain mx-auto rounded-lg border"
            />
          </CardContent>
        </Card>
      )}

      <div className="flex justify-end">
        <Button
          onClick={() => {
            if (onCaptureComplete) return onCaptureComplete({} as MedicalRecord);
            if (onExtracted) return onExtracted('', imageUrl);
          }}
          disabled={isProcessing || !imageUrl}
        >
          <Save className="mr-2 h-4 w-4" />
          Continue
        </Button>
      </div>
    </div>
  );
};
