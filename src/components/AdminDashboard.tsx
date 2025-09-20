import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Users, FileText, Activity, Settings, Eye, EyeOff, UserPlus, Clock, LogOut, ArrowLeft, Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { isAdmin } from '@/hooks/roleUtils';
import { useDashboardData } from '@/hooks/useDashboardData';
import { apiService } from '@/services/apiService';
import { useToast } from '@/components/ui/use-toast';
import { AddDoctorProfile } from './pages/AddDoctorProfile';
import { ViewDoctorProfiles } from './pages/ViewDoctorProfiles';
import { EditDoctorProfile } from './pages/EditDoctorProfile';
import { AuditLogs } from './pages/AuditLogs';
import { DeleteAccountDialog } from './DeleteAccountDialog';
import medDigitizeLogo from '@/assets/mediscan-logo.svg';

interface DashboardStats {
  totalDoctors: number;
  totalRecords: number;
  totalPatients: number;
  recentActivity: number;
}

interface Doctor {
  id: string;
  user_id: string;
  doctor_name: string;
  email: string;
  role: string;
  created_at: string;
}

interface MedicalRecord {
  id: string;
  patientId: string;
  patientName: string;
  doctorId: string;
  date: string;
  diagnosis?: string;
}

export const AdminDashboard = () => {
  const { user, signOut, doctorName, userRole } = useAuth();
  const { toast } = useToast();
  const { loading, stats, recentRecords, fetchDashboardData } = useDashboardData(isAdmin(userRole));
  const [currentView, setCurrentView] = useState<'dashboard' | 'add-doctor' | 'view-doctors' | 'edit-doctor' | 'audit-logs' | 'settings'>('dashboard');
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  const [showAdminDelete, setShowAdminDelete] = useState(false);
  // local settings form state
  const [profileName, setProfileName] = useState<string>(user?.name || '');
  const [profileUsername, setProfileUsername] = useState<string>(user?.username || '');
  const [isSaving, setIsSaving] = useState(false);
  const [isPasswordVisible, setPasswordVisible] = useState(true);
  const [currPw, setCurrPw] = useState('');
  const [newPwState, setNewPwState] = useState('');
  const [newPwConfirm, setNewPwConfirm] = useState('');
  const [isChanging, setIsChanging] = useState(false);

  // useDashboardData handles fetching + polling. fetchDashboardData is exposed for manual refreshes

  if (!isAdmin(userRole)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md text-center">
          <CardHeader><CardTitle>Access Denied</CardTitle></CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">You don't have admin privileges.</p>
            <Button onClick={() => window.history.back()}>Go Back</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/10 to-background">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <img src={medDigitizeLogo} alt="MEDiScan AI" className="h-8 w-8 rounded-full" />
              <div>
                <h1 className="text-xl font-bold text-primary">Admin Dashboard</h1>
                <p className="text-sm text-muted-foreground">{user?.username === 'admin' ? 'Hey admin' : `Welcome, ${doctorName}`}</p>
              </div>
            </div>
            <Button onClick={signOut} variant="outline">
              <LogOut className="mr-2 h-4 w-4" /> Sign Out
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Dynamic Views */}
        {currentView === 'add-doctor' && (
          <AddDoctorProfile
            onBack={() => setCurrentView('dashboard')}
            onSuccess={() => { setCurrentView('view-doctors'); fetchDashboardData(); }}
          />
        )}
        {currentView === 'view-doctors' && (
          <ViewDoctorProfiles
            onBack={() => setCurrentView('dashboard')}
            onEdit={(doctor) => { setSelectedDoctor(doctor); setCurrentView('edit-doctor'); }}
            onAdd={() => setCurrentView('add-doctor')}
            onRefresh={() => fetchDashboardData()}
          />
        )}
        {currentView === 'edit-doctor' && selectedDoctor && (
          <EditDoctorProfile
            doctor={selectedDoctor}
            onBack={() => setCurrentView('view-doctors')}
            onSuccess={() => { setCurrentView('view-doctors'); setSelectedDoctor(null); fetchDashboardData(); }}
          />
        )}
        {currentView === 'audit-logs' && (
          <AuditLogs onBack={() => setCurrentView('dashboard')} />
        )}
        {currentView === 'settings' && (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <Button variant="outline" onClick={() => setCurrentView('dashboard')}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Back
              </Button>
              <h2 className="text-2xl font-bold">Admin Settings</h2>
            </div>
            <p className="text-muted-foreground">Manage your administrator account</p>

            {/* Profile section intentionally left minimal; password change handled below in Security */}

            <Card>
              <CardHeader>
                <CardTitle>Security</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">Change your password.</p>
                <div className="space-y-3 mt-4">
                  <div className="space-y-1">
                    <label className="block text-sm font-medium">Current password</label>
                    <div className="relative">
                      <input
                        type={isPasswordVisible ? 'text' : 'password'}
                        className="input w-full pr-10"
                        value={currPw}
                        onChange={(e) => setCurrPw(e.target.value)}
                        placeholder="Enter current password"
                      />
                      <button type="button" className="absolute right-2 top-2 p-1" onClick={() => setPasswordVisible(v => !v)} aria-label={isPasswordVisible ? 'Hide password' : 'Show password'}>
                        {isPasswordVisible ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-sm font-medium">New password</label>
                    <input
                      type={isPasswordVisible ? 'text' : 'password'}
                      className="input w-full"
                      value={newPwState}
                      onChange={(e) => setNewPwState(e.target.value)}
                      placeholder="New password (min 6 chars)"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-sm font-medium">Confirm new password</label>
                    <input
                      type={isPasswordVisible ? 'text' : 'password'}
                      className="input w-full"
                      value={newPwConfirm}
                      onChange={(e) => setNewPwConfirm(e.target.value)}
                      placeholder="Confirm new password"
                    />
                  </div>

                  <div className="flex gap-2 mt-2">
                    <Button variant="ghost" disabled={isChanging} onClick={async () => {
                      if (!currPw || !newPwState) {
                        toast({ title: 'Error', description: 'Please enter current and new password', variant: 'destructive' });
                        return;
                      }
                      if (newPwState !== newPwConfirm) {
                        toast({ title: 'Error', description: 'New password and confirmation do not match', variant: 'destructive' });
                        return;
                      }
                      if (newPwState.length < 6) {
                        toast({ title: 'Error', description: 'Password must be at least 6 characters', variant: 'destructive' });
                        return;
                      }
                      setIsChanging(true);
                      try {
                        await apiService.changePassword(currPw, newPwState);
                        toast({ title: 'Success', description: 'Password changed. Please sign in again.' });
                        await signOut();
                      } catch (err: any) {
                        console.error('Change password failed', err);
                        toast({ title: 'Error', description: err?.error || err?.message || 'Failed to change password', variant: 'destructive' });
                      } finally {
                        setIsChanging(false);
                      }
                    }}>
                      {isChanging ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Changing...</>) : 'Change Password'}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div>
              <Button variant="destructive" onClick={() => setShowAdminDelete(true)}>Delete Account</Button>
            </div>
            <DeleteAccountDialog open={showAdminDelete} onClose={() => setShowAdminDelete(false)} onDelete={async () => { await signOut(); }} />
          </div>
        )}
        {currentView === 'dashboard' && (
          <>
            {/* Stats: show two synchronized cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <Card>
                <CardHeader className="flex justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Active System Users</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.totalDoctors}</div>
                  <p className="text-xs text-muted-foreground">Active system users</p>
                </CardContent>
              </Card>

              <Card>
                <div role="button" tabIndex={0} onClick={() => setCurrentView('audit-logs')} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setCurrentView('audit-logs'); }}>
                  <CardHeader className="flex justify-between pb-2">
                    <CardTitle className="text-sm font-medium">Recent Activity</CardTitle>
                    <Activity className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stats.recentActivity}</div>
                    <p className="text-xs text-muted-foreground">Logs (last 30 minutes)</p>
                  </CardContent>
                </div>
              </Card>
            </div>

            {/* Admin analytics cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <Card>
                <CardHeader className="flex justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Deleted Accounts</CardTitle>
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.deletedAccounts ?? 0}</div>
                  <p className="text-xs text-muted-foreground">Accounts deleted by admin or users</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Created Users</CardTitle>
                  <UserPlus className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.createdUsers ?? 0}</div>
                  <p className="text-xs text-muted-foreground">Total users created (accounts)</p>
                </CardContent>
              </Card>
            </div>

            {/* Admin Functions */}
            <Card className="mb-8">
              <CardHeader><CardTitle>Admin Functions</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <Button variant="outline" className="h-24 flex-col" onClick={() => setCurrentView('add-doctor')}>
                    <UserPlus className="h-6 w-6 mb-2" /> Add Doctor
                  </Button>
                  <Button variant="outline" className="h-24 flex-col" onClick={() => setCurrentView('view-doctors')}>
                    <Eye className="h-6 w-6 mb-2" /> View Doctors
                  </Button>
                  <Button variant="outline" className="h-24 flex-col" onClick={() => setCurrentView('audit-logs')}>
                    <Clock className="h-6 w-6 mb-2" /> Audit Logs
                  </Button>
                  <Button variant="outline" className="h-24 flex-col" onClick={() => setCurrentView('settings')}>
                    <Settings className="h-6 w-6 mb-2" /> Settings
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Recent Medical Records removed per request */}
          </>
        )}
      </div>
    </div>
  );
};
