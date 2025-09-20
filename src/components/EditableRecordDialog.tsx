import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Save, X } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { apiService } from '@/services/apiService';

interface MedicalRecord {
  id: string;
  patient_id: string;
  patient_name: string;
  age: number | null;
  gender: string | null;
  date_recorded: string;
  diagnosis: string | null;
  prescription: string | null;
  raw_text?: string | null;
  image_url?: string | null;
  created_at: string;
}

interface EditableRecordDialogProps {
  record: MedicalRecord | null;
  onClose: () => void;
  onUpdate: (updatedRecord: MedicalRecord) => void;
}

export const EditableRecordDialog = ({ record, onClose, onUpdate }: EditableRecordDialogProps) => {
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    patient_name: '',
    age: '',
    gender: '',
    date_recorded: '',
    diagnosis: '',
    prescription: ''
  });

  const [isSaving, setIsSaving] = useState(false);

  // Populate form when record changes
  useEffect(() => {
    if (!record) return;
    setFormData({
      patient_name: record.patient_name,
      age: record.age?.toString() || '',
      gender: record.gender || '',
      date_recorded: record.date_recorded,
      diagnosis: record.diagnosis || '',
      prescription: record.prescription || ''
    });
  }, [record]);

  if (!record) return null;

  const handleSave = async () => {
    if (!formData.patient_name.trim()) {
      toast({
        title: 'Error',
        description: 'Patient name is required',
        variant: 'destructive'
      });
      return;
    }

    setIsSaving(true);

    try {
      const updated = await apiService.updateMedicalRecord(record.id, {
        patientName: formData.patient_name,
        age: formData.age ? parseInt(formData.age) : null,
        gender: formData.gender || null,
        date: formData.date_recorded || new Date().toISOString().split('T')[0],
        diagnosis: formData.diagnosis || null,
        prescription: formData.prescription || null,
      });

      const formattedRecord: MedicalRecord = {
        ...record,
        patient_name: updated.patientName,
        age: updated.age,
        gender: updated.gender,
        date_recorded: updated.date,
        diagnosis: updated.diagnosis,
        prescription: updated.prescription
      };

      onUpdate(formattedRecord);

      toast({
        title: 'Success',
        description: 'Medical record updated successfully'
      });

      onClose();
    } catch (error) {
      console.error('Update error:', error);
      toast({
        title: 'Error',
        description: 'Failed to update medical record',
        variant: 'destructive'
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={!!record} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Medical Record</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Patient Name */}
          <div className="space-y-2">
            <Label htmlFor="patient_name">Patient Name *</Label>
            <Input
              id="patient_name"
              placeholder="Enter patient name"
              value={formData.patient_name}
              onChange={(e) => setFormData({ ...formData, patient_name: e.target.value })}
            />
          </div>

          {/* Age & Gender */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="age">Age</Label>
              <Input
                id="age"
                type="number"
                placeholder="Age"
                value={formData.age}
                onChange={(e) => setFormData({ ...formData, age: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="gender">Gender</Label>
              <Select
                value={formData.gender}
                onValueChange={(value) => setFormData({ ...formData, gender: value })}
              >
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

          {/* Date Recorded */}
          <div className="space-y-2">
            <Label htmlFor="date_recorded">Date</Label>
            <Input
              id="date_recorded"
              type="date"
              value={formData.date_recorded}
              onChange={(e) => setFormData({ ...formData, date_recorded: e.target.value })}
            />
          </div>

          {/* Diagnosis & Prescription */}
          <div className="space-y-2">
            <Label htmlFor="diagnosis">Diagnosis</Label>
            <Textarea
              id="diagnosis"
              rows={3}
              placeholder="Enter diagnosis"
              value={formData.diagnosis}
              onChange={(e) => setFormData({ ...formData, diagnosis: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="prescription">Prescription</Label>
            <Textarea
              id="prescription"
              rows={3}
              placeholder="Enter prescription"
              value={formData.prescription}
              onChange={(e) => setFormData({ ...formData, prescription: e.target.value })}
            />
          </div>

          {/* Original Image */}
          {record.image_url && (
            <div className="space-y-2">
              <Label>Original Image</Label>
              <img
                src={record.image_url}
                alt="Medical Record"
                className="max-w-full h-48 object-contain rounded border"
              />
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 justify-end pt-4">
            <Button variant="outline" onClick={onClose}>
              <X className="mr-2 h-4 w-4" /> Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              <Save className={`mr-2 h-4 w-4 ${isSaving ? 'animate-spin' : ''}`} />
              {isSaving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
