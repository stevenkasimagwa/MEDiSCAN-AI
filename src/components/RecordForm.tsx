import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogTrigger, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Save, ArrowLeft, Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { apiService } from '@/services/apiService';
import ZoomableImage from './ZoomableImage';
import { useAuth } from '@/hooks/useAuth';

interface RecordFormProps {
  imageUrl: string;
  onSaved: () => void;
  onBack: () => void;
}

export const RecordForm = ({ imageUrl, onSaved, onBack }: RecordFormProps) => {
  const { user } = useAuth();
  const { toast } = useToast();

  const [fields, setFields] = useState({
    patientName: '',
    age: '',
    gender: '',
    date: new Date().toISOString().split('T')[0],
    diagnosis: '',
    prescription: '',
    patientId: '',
    weight: '',
    height: '',
    temperature: '',
    rawText: ''
  });

  const [confidences, setConfidences] = useState<{ [k: string]: number }>({});

  const [isSaving, setIsSaving] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Try to auto-detect or generate a patient identifier from OCR text
  const generatePatientIdFromOCR = (text: string) => {
    if (!text) return '';
    // common patterns: PID-12345, PID 12345, MRN: 12345, Patient ID: 12345
    const patterns = [/(PID[-:\s]*\d{3,})/i, /(MRN[-:\s]*\d{3,})/i, /Patient\s*ID[:\s]*(\w[-\w\d]*)/i, /(ID[:\s]*\d{3,})/i];
    for (const p of patterns) {
      const m = text.match(p);
      if (m) {
        // prefer a normalized 'PID-xxxxx' format when possible
        const found = m[0];
        const digits = found.match(/\d+/g)?.join('') || '';
        if (digits) return `PID-${digits}`;
        return found.replace(/\s+/g, '-');
      }
    }
    // fallback: deterministic short id using timestamp + random
    return `PID-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
  };

  // Automatically call OCR when imageUrl changes
  useEffect(() => {
    const fetchOCR = async () => {
      if (!imageUrl) return;
      setIsProcessing(true);

      // Helper: try fetch(), otherwise fallback to loading into an <img> and drawing to canvas
      const fetchBlobFromUrl = async (url: string): Promise<Blob> => {
        try {
          const resp = await fetch(url, { cache: 'no-store' });
          if (resp.ok) return await resp.blob();
        } catch (e) {
          console.debug('fetch() failed, will try image->canvas fallback', e);
        }

        return await new Promise<Blob>((resolve, reject) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => {
            try {
              const canvas = document.createElement('canvas');
              canvas.width = img.naturalWidth || img.width;
              canvas.height = img.naturalHeight || img.height;
              const ctx = canvas.getContext('2d');
              if (!ctx) return reject(new Error('Canvas 2D context unavailable'));
              ctx.drawImage(img, 0, 0);
              canvas.toBlob((blob) => {
                if (blob) resolve(blob);
                else reject(new Error('Canvas toBlob produced null'));
              }, 'image/jpeg', 0.95);
            } catch (err) {
              reject(err);
            }
          };
          img.onerror = () => reject(new Error('Image load failed for fallback'));
          img.src = url;
        });
      };

      // Single retry wrapper for uploads
      const uploadWithRetry = async (file: File, attempts = 2): Promise<any> => {
        let lastErr: any = null;
        for (let i = 0; i < attempts; i++) {
          try {
            return await apiService.uploadFile(file);
          } catch (e: any) {
            lastErr = e;
            console.warn('uploadFile attempt failed', i + 1, e);
            // quick backoff
            await new Promise((r) => setTimeout(r, 300 * (i + 1)));
          }
        }
        throw lastErr;
      };

      try {
        const blob = await fetchBlobFromUrl(imageUrl);
        const file = new File([blob], 'scan.jpg', { type: blob.type || 'image/jpeg' });

        const ocrResult = await uploadWithRetry(file, 2);
        const extracted = ocrResult?.fields ?? (ocrResult ?? {});
        const conf = ocrResult?.confidence ?? {};

        setFields({
          patientName: extracted.patient_name || '',
          age: extracted.age ?? '',
          gender: extracted.sex || '',
          diagnosis: extracted.diagnosis || '',
          prescription: extracted.medications || '',
          patientId: extracted.patient_id || extracted.patientId || '',
          weight: extracted.weight || '',
          height: extracted.height || '',
          temperature: extracted.temperature || '',
          date: new Date().toISOString().split('T')[0],
          rawText: extracted.raw_text || extracted.rawText || ''
        });
        setConfidences(conf);

        toast({ title: 'OCR Complete', description: 'Medical record extracted successfully' });
        if (!extracted.patient_id && !extracted.patientId) {
          const gen = generatePatientIdFromOCR(extracted.raw_text || extracted.rawText || '');
          if (gen) setFields(prev => ({ ...prev, patientId: gen }));
        }
      } catch (err: any) {
        console.error('OCR failed:', err);
        const msg = (err && err.message) ? err.message : String(err);
        if (msg.toLowerCase().includes('failed to reach') || msg.toLowerCase().includes('network error') || msg.toLowerCase().includes('failed to fetch')) {
          toast({ title: 'OCR failed: Network/CORS', description: 'Could not reach OCR backend. Check that the API server is running and CORS/Access-Control-Allow-Origin is configured.', variant: 'destructive' });
        } else if (msg.toLowerCase().includes('unsupported file type') || msg.toLowerCase().includes('no file')) {
          toast({ title: 'OCR failed: Bad file', description: 'Uploaded file was rejected as unsupported by the server.', variant: 'destructive' });
        } else {
          toast({ title: 'OCR extraction failed', description: msg, variant: 'destructive' });
        }
      } finally {
        setIsProcessing(false);
      }
    };

    fetchOCR();
  }, [imageUrl, toast]);

  const handleSave = async () => {
    if (!user) return;

    if (!fields.patientName.trim()) {
      toast({ title: 'Error', description: 'Patient name is required', variant: 'destructive' });
      return;
    }

    setIsSaving(true);

    try {
      let imageStorageUrl = '';

      // Determine image URL to store:
      // - If imageUrl is a blob or data URL, upload and get server URL
      // - If imageUrl is already a server URL (absolute or relative), use it directly
      if (imageUrl) {
        if (imageUrl.startsWith('blob:') || imageUrl.startsWith('data:')) {
          // convert blob/data URL to file and upload
          if (imageUrl.startsWith('blob:')) {
            const response = await fetch(imageUrl);
            const blob = await response.blob();
            const file = new File([blob], `record_${Date.now()}.jpg`, { type: blob.type || 'image/jpeg' });
            const uploadResult = await apiService.uploadFile(file);
            imageStorageUrl = uploadResult.url || uploadResult.file_url || '';
          } else {
            // data URL (base64)
            try {
              const res = await fetch(imageUrl);
              const blob = await res.blob();
              const file = new File([blob], `record_${Date.now()}.jpg`, { type: blob.type || 'image/jpeg' });
              const uploadResult = await apiService.uploadFile(file);
              imageStorageUrl = uploadResult.url || uploadResult.file_url || '';
            } catch (e) {
              // fallback: leave imageStorageUrl empty
              console.error('Failed to convert data URL to file', e);
            }
          }
        } else if (imageUrl.startsWith('http') || imageUrl.startsWith('/')) {
          // Already a server-hosted URL or absolute URL - persist as-is
          imageStorageUrl = imageUrl;
        }
      }

      await apiService.createMedicalRecord({
        patient_name: fields.patientName,
        age: Number(fields.age) || undefined,
        sex: fields.gender,
        diagnosis: fields.diagnosis,
        medications: fields.prescription,
        patient_id: fields.patientId || undefined,
        weight: fields.weight ? Number(fields.weight) : undefined,
        height: fields.height ? Number(fields.height) : undefined,
        temperature: fields.temperature ? Number(fields.temperature) : undefined,
        raw_text: fields.rawText,
        image_url: imageStorageUrl,
        doctor_name: String(user.username ?? user.id ?? '')
      });

      toast({ title: 'Success', description: 'Medical record saved successfully' });
      onSaved();
    } catch (err) {
      console.error(err);
      toast({ title: 'Error', description: 'Failed to save medical record', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <h2 className="text-2xl font-bold">Review & Edit Medical Record</h2>
      </div>

      {isProcessing ? (
        <div className="flex items-center justify-center gap-2 text-muted-foreground">
          <Loader2 className="animate-spin h-5 w-5" />
          Processing OCR...
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Extracted Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="patientId">Patient ID</Label>
                <Input
                  id="patientId"
                  value={fields.patientId}
                  onChange={(e) => setFields({ ...fields, patientId: e.target.value })}
                  placeholder="Auto-generated or extracted ID"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="patientName">Patient Name *</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="patientName"
                    value={fields.patientName}
                    onChange={(e) => setFields({ ...fields, patientName: e.target.value })}
                    placeholder="Enter patient name"
                  />
                  {confidences.patient_name !== undefined && confidences.patient_name < 60 && (
                    <span className="text-xs text-yellow-700 bg-yellow-100 px-2 py-1 rounded">Low confidence</span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="age">Age</Label>
                  <Input
                    id="age"
                    type="number"
                    value={fields.age}
                    onChange={(e) => setFields({ ...fields, age: e.target.value })}
                    placeholder="Age"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="gender">Gender</Label>
                  <Select value={fields.gender} onValueChange={(value) => setFields({ ...fields, gender: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select gender" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Male">Male</SelectItem>
                      <SelectItem value="Female">Female</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="weight">Weight</Label>
                  <Input
                    id="weight"
                    value={fields.weight}
                    onChange={(e) => setFields({ ...fields, weight: e.target.value })}
                    placeholder="e.g. 82 kg"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="height">Height</Label>
                  <Input
                    id="height"
                    value={fields.height}
                    onChange={(e) => setFields({ ...fields, height: e.target.value })}
                    placeholder="e.g. 180 cm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="temperature">Temperature</Label>
                  <Input
                    id="temperature"
                    value={fields.temperature}
                    onChange={(e) => setFields({ ...fields, temperature: e.target.value })}
                    placeholder="e.g. 37.0"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="date">Date</Label>
                <Input
                  id="date"
                  type="date"
                  value={fields.date}
                  onChange={(e) => setFields({ ...fields, date: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="diagnosis">Diagnosis</Label>
                <Textarea
                  id="diagnosis"
                  value={fields.diagnosis}
                  onChange={(e) => setFields({ ...fields, diagnosis: e.target.value })}
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="prescription">Prescription</Label>
                <Textarea
                  id="prescription"
                  value={fields.prescription}
                  onChange={(e) => setFields({ ...fields, prescription: e.target.value })}
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Original Image</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {imageUrl && (
                    <div className="flex items-center justify-center">
                      <Dialog>
                        <DialogTrigger asChild>
                          <button className="focus:outline-none">
                            <img src={imageUrl} alt="Medical Record" className="max-w-full h-48 object-contain mx-auto rounded-lg border cursor-zoom-in" />
                          </button>
                        </DialogTrigger>

                        <DialogContent className="max-w-4xl">
                          <DialogHeader>
                            <DialogTitle>Original Scan — Zoom & Inspect</DialogTitle>
                          </DialogHeader>
                          <div className="mt-4 flex flex-col items-center">
                            <ZoomableImage src={imageUrl} alt="Medical Record Full" />
                          </div>
                          <DialogFooter>
                            <DialogClose>
                              <button className="btn">Close</button>
                            </DialogClose>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </div>
                  )}
            </CardContent>
          </Card>
        </div>
      )}

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isSaving || isProcessing}>
          {isSaving ? (
            <>
              <Save className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Save Record
            </>
          )}
        </Button>
      </div>
    </div>
  );
};
