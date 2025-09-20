import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { isAdmin, isDoctor } from '@/hooks/roleUtils';
import { apiService } from '@/services/apiService';
import { useToast } from '@/components/ui/use-toast';
import ZoomableImage from './ZoomableImage';

interface RecordDetailsDialogProps {
  record: any | null;
  onClose: () => void;
}

export const RecordDetailsDialog: React.FC<RecordDetailsDialogProps> = ({ record, onClose }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [showRaw, setShowRaw] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (!record) return null;

  const role = (user as any)?.role;
  const isClinician = isDoctor(role) || isAdmin(role);

  const handleDelete = async () => {
    if (!record) return;
    if (!confirm('Delete this record? This action cannot be undone.')) return;
    setDeleting(true);
    try {
      await apiService.deleteMedicalRecord(Number(record.id));
      toast({ title: 'Deleted', description: 'Record deleted successfully' });
      onClose();
    } catch (err) {
      console.error('Delete failed', err);
      toast({ title: 'Error', description: 'Failed to delete record', variant: 'destructive' });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Dialog open={!!record} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="w-full max-w-3xl md:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Record Details</DialogTitle>
        </DialogHeader>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-1">
            {record.image_url ? (
              <div className="bg-muted rounded overflow-hidden">
                <div className="w-full h-auto max-h-96">
                  <ZoomableImage src={record.image_url} alt={`record-${record.id}`} />
                </div>
              </div>
            ) : (
              <div className="h-40 flex items-center justify-center bg-muted rounded text-sm text-muted-foreground">No image available</div>
            )}
          </div>

          <div className="md:col-span-2 space-y-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div><strong>Patient ID:</strong> <div className="text-sm">{record.patient_id || '-'}</div></div>
              <div><strong>Recorded:</strong> <div className="text-sm">{record.created_at || '-'}</div></div>
              <div><strong>Patient:</strong> <div className="text-sm">{record.patient_name}</div></div>
              <div><strong>Doctor:</strong> <div className="text-sm">{record.doctor_name}</div></div>
            </div>

            <div>
              <h4 className="font-semibold">Diagnosis</h4>
              <div className="text-sm break-words">{record.diagnosis || '-'}</div>
            </div>

            <div>
              <h4 className="font-semibold">Medications / Prescription</h4>
              <div className="text-sm break-words">{record.medications || record.prescription || '-'}</div>
            </div>

            <div className="pt-2">
              <Button variant="ghost" onClick={() => setShowRaw(!showRaw)}>{showRaw ? 'Hide raw extracted text' : 'View raw extracted text'}</Button>
              {showRaw && (
                <pre className="mt-2 p-2 bg-muted rounded text-sm overflow-auto max-h-60 break-words">{record.raw_text || 'No extracted text available.'}</pre>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="flex gap-2">
          <Button onClick={onClose}>Close</Button>
          {isClinician && (
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>{deleting ? 'Deleting...' : 'Delete'}</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RecordDetailsDialog;
