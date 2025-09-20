import { useEffect, useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { apiService } from '@/services/apiService';
import { useRecords } from '@/context/RecordsContext';
import { Dialog, DialogContent, DialogTrigger, DialogHeader, DialogTitle, DialogFooter, DialogClose } from './ui/dialog';
import { useAuth } from '@/hooks/useAuth';
import { isAdmin, isDoctor } from '@/hooks/roleUtils';
import { useToast } from '@/components/ui/use-toast';
import ZoomableImage from './ZoomableImage';
import { useNavigate } from 'react-router-dom';

interface MedicalRecord {
  id: string;
  patient_name: string;
  doctor_name?: string;
  diagnosis?: string;
  raw_text?: string | null;
  status?: 'pending' | 'completed' | 'review';
  created_at?: string;
  patient_id?: string;
  age?: number | null;
  medications?: string | null;
  image_url?: string | null;
}

interface RecordTableProps {
  records?: MedicalRecord[];
  onView?: (r: MedicalRecord) => void;
  onEdit?: (r: MedicalRecord) => void;
  onDelete?: (id: string) => void;
  sortField?: string;
  sortDirection?: string;
  onSort?: (field: string) => void;
}

export const RecordTable = ({ records: propRecords, onView, onEdit, onDelete, sortField, sortDirection, onSort }: RecordTableProps) => {
  const { records, fetchRecords, searchTerm, setSearchTerm, loading } = useRecords();
  const { toast } = useToast();
  const { user } = useAuth();
  const role = (user as any)?.role;
  const canEdit = isDoctor(role) || isAdmin(role);
  const [selectedRecord, setSelectedRecord] = useState<MedicalRecord | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [showRaw, setShowRaw] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Only fetch when we don't have propRecords provided
    if (!propRecords) fetchRecords();
  }, [fetchRecords, propRecords]);

  const sourceRecords = propRecords || records || [];
  const filteredRecords = (sourceRecords || []).filter((r) => {
    const term = (searchTerm || '').toString().toLowerCase();
    if (!term) return true;
    const patientName = (r.patient_name || '').toString().toLowerCase();
    const patientId = (r.patient_id || '').toString().toLowerCase();
    const doctor = (r.doctor_name || '').toString().toLowerCase();
    const diag = (r.diagnosis || '').toString().toLowerCase();
    const meds = (r.medications || r.raw_text || '').toString().toLowerCase();
    return (
      patientName.includes(term) ||
      patientId.includes(term) ||
      doctor.includes(term) ||
      diag.includes(term) ||
      meds.includes(term)
    );
  });

  const getStatusBadge = (status: string) => {
    const colors: Record<string, 'default' | 'secondary' | 'destructive'> = {
      pending: 'secondary',
      completed: 'default',
      review: 'destructive',
    };
    return <Badge variant={colors[status] || 'default'}>{status}</Badge>;
  };

  return (
    <>
      {/* Heading is shown in the top-level Dashboard header when viewing records */}

      <Card>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <>
              {/* Mobile: compact label/value grid per record */}
              <div className="space-y-3 md:hidden">
                {filteredRecords.length === 0 ? (
                  <div className="text-center text-muted-foreground">No records found</div>
                ) : (
                  filteredRecords.map((record) => (
                    <div key={record.id} className="p-3 border rounded bg-background">
                      <div className="grid grid-cols-3 gap-2 items-center">
                        <div className="text-xs text-muted-foreground">Patient ID</div>
                        <div className="col-span-2 text-sm truncate">{record.patient_id || '-'}</div>

                        <div className="text-xs text-muted-foreground">Patient</div>
                        <div className="col-span-2 text-sm truncate">{record.patient_name}</div>

                        <div className="text-xs text-muted-foreground">Age</div>
                        <div className="col-span-2 text-sm">{record.age ?? '-'}</div>

                        <div className="text-xs text-muted-foreground">Diagnosis</div>
                        <div className="col-span-2 text-sm truncate">{record.diagnosis || '-'}</div>

                        <div className="text-xs text-muted-foreground">Prescription</div>
                        <div className="col-span-2 text-sm truncate">{record.medications || record.prescription || '-'}</div>

                        <div className="text-xs text-muted-foreground">Created</div>
                        <div className="col-span-2 text-xs text-muted-foreground truncate">{record.created_at ? new Date(record.created_at).toLocaleString() : '-'}</div>

                        <div className="col-span-3 mt-2 flex justify-end">
                          <button
                            className="px-3 py-1 rounded border text-sm whitespace-nowrap"
                            onClick={() => navigate(`/record/${record.id}`)}
                          >
                            View
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Desktop/tablet: regular table */}
              <div className="hidden md:block w-full">
                <Table noWrapperOverflow className="w-full table-fixed text-left align-middle">
                  <colgroup>
                    <col style={{ width: '12%' }} />
                    <col style={{ width: '22%' }} />
                    <col style={{ width: '6%' }} />
                    <col style={{ width: '24%' }} />
                    <col style={{ width: '18%' }} />
                    <col style={{ width: '12%' }} />
                    <col style={{ width: '6%' }} />
                  </colgroup>
                  <TableHeader>
                    <TableRow>
                      <TableHead style={{ width: '12%' }} className="!p-2 whitespace-nowrap">Patient ID</TableHead>
                      <TableHead style={{ width: '22%' }} className="!p-2">Patient</TableHead>
                      <TableHead style={{ width: '6%' }} className="text-center !p-2 whitespace-nowrap">Age</TableHead>
                      <TableHead style={{ width: '24%' }} className="!p-2">Diagnosis</TableHead>
                      <TableHead style={{ width: '18%' }} className="!p-2">Prescription</TableHead>
                      <TableHead style={{ width: '12%' }} className="!p-2">Created</TableHead>
                      <TableHead style={{ width: '6%' }} className="!p-2"><span className="sr-only">Actions</span></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRecords.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground">
                          No records found
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredRecords.map((record) => (
                        <TableRow key={record.id}>
                          <TableCell className="!p-2 truncate">{record.patient_id || '-'}</TableCell>
                          <TableCell className="!p-2 truncate">{record.patient_name}</TableCell>
                          <TableCell className="!p-2 text-center whitespace-nowrap">{record.age ?? '-'}</TableCell>
                          <TableCell className="!p-2 truncate break-words">{record.diagnosis || '-'}</TableCell>
                          <TableCell className="!p-2 truncate break-words">{record.medications || record.prescription || '-'}</TableCell>
                          <TableCell className="!p-2 text-xs truncate">{record.created_at ? new Date(record.created_at).toLocaleString() : '-'}</TableCell>
                          <TableCell className="!p-2 align-middle text-center">
                            <button
                              className="px-2 py-1 rounded border text-sm inline-flex items-center whitespace-nowrap"
                              onClick={() => navigate(`/record/${record.id}`)}
                            >
                              View
                            </button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Dialog for viewing selected record (image + details) */}
      {selectedRecord && (
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>Record — {selectedRecord.patient_name}</DialogTitle>
            </DialogHeader>
            <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div>
                {selectedRecord.image_url ? (
                  <ZoomableImage src={selectedRecord.image_url} alt={`record-${selectedRecord.id}`} />
                ) : (
                  <div className="text-muted-foreground">No image available</div>
                )}
              </div>
              <div>
                <h3 className="font-semibold">Patient</h3>
                <div>{selectedRecord.patient_name}</div>
                <h3 className="font-semibold mt-4">Diagnosis</h3>
                <div>{selectedRecord.diagnosis}</div>
                <h3 className="font-semibold mt-4">Doctor</h3>
                <div>{selectedRecord.doctor_name}</div>

                <div className="pt-4">
                  <button
                    className="px-2 py-1 rounded border text-sm mr-2"
                    onClick={() => setShowRaw(!showRaw)}
                  >
                    {showRaw ? 'Hide raw extracted text' : 'View raw extracted text'}
                  </button>
                  { canEdit ? (
                    <button
                      className="px-2 py-1 rounded border text-sm text-red-600"
                      onClick={async () => {
                        if (!confirm('Delete this record? This action cannot be undone.')) return;
                        setDeleting(true);
                        try {
                          await apiService.deleteMedicalRecord(Number(selectedRecord.id));
                          toast({ title: 'Deleted', description: 'Record deleted successfully' });
                          setDialogOpen(false);
                          await fetchRecords();
                        } catch (err) {
                          console.error('Delete failed', err);
                          toast({ title: 'Error', description: 'Failed to delete record', variant: 'destructive' });
                        } finally {
                          setDeleting(false);
                        }
                      }}
                      disabled={deleting}
                    >{deleting ? 'Deleting...' : 'Delete'}</button>
                  ) : null }

                  {showRaw && (
                    <pre className="mt-3 p-2 bg-muted rounded text-sm overflow-auto max-h-60">{selectedRecord.raw_text || 'No extracted text available.'}</pre>
                  )}
                </div>
              </div>
            </div>
            <DialogFooter>
              <DialogClose>
                <button className="btn">Close</button>
              </DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
};
