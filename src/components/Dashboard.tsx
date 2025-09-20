import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/components/ui/use-toast';
import { apiService, DashboardMedicalRecord } from '@/services/apiService';
import { RecordsProvider, useRecords } from '@/context/RecordsContext';
import { DashboardSidebar } from './DashboardSidebar';
import { RecordTable } from './RecordTable';
import { EditableRecordDialog } from './EditableRecordDialog';
import { RecordDetailsDialog } from './RecordDetailsDialog';
import { DeleteAccountDialog } from './DeleteAccountDialog';
import { MedicalAnalytics } from './MedicalAnalytics';
import { MedicalDashboard } from './MedicalDashboard';
import { PatientSearch } from './PatientSearch';
import { LoadingSpinner } from './LoadingSpinner';
import { SearchBar } from './SearchBar';
import { Search } from 'lucide-react';

type SortField = 'patient_name' | 'age' | 'gender' | 'date_recorded';
type SortDirection = 'asc' | 'desc';

interface DashboardProps {
  onNewScan: () => void;
}

const DashboardInner = ({ onNewScan }: DashboardProps) => {
  const { user, signOut, doctorName } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const { records, fetchRecords, searchTerm, setSearchTerm } = useRecords();

  // Load records on mount and clear the local loading state
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        setLoading(true);
        await fetchRecords();
      } catch (e) {
        console.error('Failed to fetch records in DashboardInner', e);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [currentView, setCurrentView] = useState<'records' | 'dashboard' | 'analytics' | 'search' | 'settings'>('dashboard');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<DashboardMedicalRecord | null>(null);
  const [editingRecord, setEditingRecord] = useState<DashboardMedicalRecord | null>(null);
  const [showDeleteAccount, setShowDeleteAccount] = useState(false);
  const [sortField, setSortField] = useState<SortField>('date_recorded');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Local settings state
  const [nameInput, setNameInput] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [isChanging, setIsChanging] = useState(false);

  useEffect(() => {
    setNameInput(doctorName || (user as any)?.name || (user as any)?.username || '');
  }, [doctorName, user]);

  const handleDeleteRecord = async (recordId: string) => {
    try {
      await apiService.deleteMedicalRecord(recordId);
      toast({ title: 'Deleted', description: 'Record deleted successfully' });
      await fetchRecords();
    } catch (err) {
      console.error(err);
      toast({ title: 'Error', description: 'Failed to delete record', variant: 'destructive' });
    }
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    setIsSaving(true);
    try {
      await apiService.updateDoctorProfile(String((user as any).id), { username: (user as any).username, name: nameInput });
      const updated = { ...(user as any), name: nameInput };
      localStorage.setItem('user', JSON.stringify(updated));
      toast({ title: 'Saved', description: 'Profile updated' });
      window.location.reload();
    } catch (err) {
      console.error('Save profile failed', err);
      toast({ title: 'Error', description: 'Failed to save profile', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangePassword = async () => {
    setIsChanging(true);
    try {
      await apiService.changePassword(currentPassword, newPassword);
      toast({ title: 'Password Changed', description: 'Your password was updated' });
      setCurrentPassword('');
      setNewPassword('');
    } catch (err) {
      console.error('Change password failed', err);
      toast({ title: 'Error', description: 'Failed to change password', variant: 'destructive' });
    } finally {
      setIsChanging(false);
    }
  };

  const handleRecordUpdate = (updated: DashboardMedicalRecord) => {
    // refresh records from server for consistency
    fetchRecords();
    setEditingRecord(null);
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDirection('asc'); }
  };

  const sortedAndFilteredRecords = useMemo(() => {
    return (records || [])
      .filter(r => {
        const name = (r.patient_name || '').toString().toLowerCase();
        const id = (r.patient_id || '').toString().toLowerCase();
        const diag = (r.diagnosis || '').toString().toLowerCase();
        const q = searchTerm.toLowerCase();
        return name.includes(q) || id.includes(q) || diag.includes(q);
      })
      .sort((a, b) => {
        let aVal: any = sortField === 'age' ? a.age || 0 : (a[sortField] || '').toString().toLowerCase();
        let bVal: any = sortField === 'age' ? b.age || 0 : (b[sortField] || '').toString().toLowerCase();
        if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
  }, [records, searchTerm, sortField, sortDirection]);

  if (loading) return <LoadingSpinner />;
  return (
    <div className="min-h-screen flex bg-background">
      {/* Sidebar for md+ screens */}
      <div className="hidden md:block">
        <DashboardSidebar currentView={currentView} onViewChange={setCurrentView} />
      </div>

      {/* Mobile overlay sidebar */}
      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileSidebarOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 max-w-full bg-card border-r border-border">
            <DashboardSidebar currentView={currentView} onViewChange={(v) => { setCurrentView(v); setMobileSidebarOpen(false); }} onCloseMobile={() => setMobileSidebarOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex-1 p-4 md:p-6">
        {/* Header: show greeting on dashboard, show page heading on records view */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          {/* Mobile menu button */}
          <div className="md:hidden mb-2">
            <Button variant="ghost" onClick={() => setMobileSidebarOpen(true)}>
              <span className="sr-only">Open menu</span>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </Button>
          </div>
          <div>
            {currentView === 'dashboard' && (
              <p className="text-muted-foreground">Hey, {(doctorName || (user as any)?.name || (user as any)?.username) ?? 'Doctor'}! Welcome.</p>
            )}
            {currentView === 'records' && (
              <div className="flex items-center gap-2">
                <Search className="h-5 w-5" />
                <h2 className="text-2xl font-semibold">Medical Records ({sortedAndFilteredRecords.length})</h2>
              </div>
            )}
          </div>
          {(currentView === 'dashboard' || currentView === 'records') && (
            <Button onClick={onNewScan}>New Scan</Button>
          )}
        </div>

        {/* View Switch */}
        {currentView === 'records' && (
          <>
            <SearchBar />
            <RecordTable
              records={sortedAndFilteredRecords}
              onView={setSelectedRecord}
              onEdit={setEditingRecord}
              onDelete={handleDeleteRecord}
              sortField={sortField}
              sortDirection={sortDirection}
              onSort={handleSort}
            />
          </>
        )}
  {currentView === 'dashboard' && <MedicalDashboard records={records} onNavigateToSearch={() => setCurrentView('search')} onNavigateToAnalytics={() => setCurrentView('analytics')} />}
  {currentView === 'analytics' && <MedicalAnalytics records={records} />}
  {currentView === 'search' && <PatientSearch records={records} initialSearchTerm={searchTerm} />}
        {currentView === 'settings' && (
          <div className="space-y-4 max-w-lg">
            <h2 className="text-xl font-semibold">Profile Settings</h2>

            <div className="space-y-2">
              <label className="text-sm">Display Name</label>
              <input
                className="w-full border rounded px-3 py-2"
                value={nameInput}
                onChange={e => setNameInput(e.target.value)}
                placeholder="Your display name"
              />
              <p className="text-sm text-muted-foreground">Username: {(user as any)?.username}</p>
              <div className="flex gap-2">
                <Button onClick={handleSaveProfile} disabled={isSaving}>{isSaving ? 'Saving...' : 'Save'}</Button>
                <Button variant="ghost" onClick={() => { setNameInput(doctorName || (user as any)?.name || (user as any)?.username || ''); }}>Reset</Button>
              </div>
            </div>

            <div className="pt-4 space-y-2">
              <h3 className="text-lg font-medium">Change Password</h3>
              <input type="password" placeholder="Current password" className="w-full border rounded px-3 py-2" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} />
              <input type="password" placeholder="New password" className="w-full border rounded px-3 py-2" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
              <div className="flex gap-2">
                <Button onClick={handleChangePassword} disabled={isChanging}>{isChanging ? 'Changing...' : 'Change Password'}</Button>
              </div>
            </div>

            <div className="pt-4">
              <Button variant="destructive" onClick={() => setShowDeleteAccount(true)}>Delete Account</Button>
            </div>
          </div>
        )}

          {/* Dialogs */}
          <RecordDetailsDialog record={selectedRecord} onClose={() => setSelectedRecord(null)} />
          <EditableRecordDialog record={editingRecord} onClose={() => setEditingRecord(null)} onUpdate={handleRecordUpdate} />
          <DeleteAccountDialog open={showDeleteAccount} onClose={() => setShowDeleteAccount(false)} onDelete={signOut} />
        </div>
      </div>
  );
};

// Wrapper that supplies the records context
export const Dashboard = (props: DashboardProps) => {
    return (
      <RecordsProvider>
        <DashboardInner {...props} />
      </RecordsProvider>
    );
  };

