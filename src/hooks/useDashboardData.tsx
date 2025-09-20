import { useEffect, useState, useCallback } from 'react';
import { apiService } from '@/services/apiService';

interface DashboardStats {
  totalDoctors: number;
  totalRecords: number;
  totalPatients: number;
  recentActivity: number;
  deletedAccounts?: number;
  createdUsers?: number;
}

interface MedicalRecord {
  id: string;
  patientId: string;
  patientName: string;
  doctorId: string;
  date: string;
  diagnosis?: string;
}

export const useDashboardData = (enabled: boolean) => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>({ totalDoctors: 0, totalRecords: 0, totalPatients: 0, recentActivity: 0 });
  const [recentRecords, setRecentRecords] = useState<MedicalRecord[]>([]);

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      const doctors: any[] = await apiService.getDoctorProfiles();
      const records: any[] = await apiService.getMedicalRecords();
      const uniquePatients = new Set(records.map(r => r.patient_id || r.patientId)).size;

      // Fetch audit logs and compute recent activity in last 30 minutes
      const logs: any[] = await apiService.getAuditLogs();
      const now = Date.now();
      const recent30 = logs.filter(l => {
        try {
          const t = new Date(l.created_at).getTime();
          return (now - t) <= (30 * 60 * 1000);
        } catch (e) { return false; }
      }).length;

      // compute deleted accounts and created users from audit logs
      const deletedAccounts = logs.filter(l => l.action === 'DELETE' && l.resource_type === 'user').length;
      const createdUsers = logs.filter(l => l.action === 'CREATE' && l.resource_type === 'user').length;

      setStats({
        totalDoctors: doctors.length,
        totalRecords: records.length,
        totalPatients: uniquePatients,
        recentActivity: recent30,
        deletedAccounts,
        createdUsers
      });

      // Normalize records to the shape used by the dashboard (keep recentRecords for other areas if needed)
      setRecentRecords(records.map(r => ({
        id: String(r.id),
        patientId: r.patient_id || r.patientId || r.patientId,
        patientName: r.patient_name || r.patientName || r.patientName,
        doctorId: r.doctor_name || r.doctorId || r.doctor_name || r.doctorId,
        date: r.date || r.created_at || new Date().toISOString(),
        diagnosis: r.diagnosis || r.raw_text || ''
      })));
    } catch (error) {
      console.error('fetchDashboardData failed', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch once when enabled. Polling removed to avoid frequent refreshes.
  useEffect(() => {
    if (!enabled) return;
    fetchDashboardData();
    // No polling — caller can call fetchDashboardData() manually when needed.
  }, [enabled, fetchDashboardData]);

  return { loading, stats, recentRecords, fetchDashboardData };
};

export default useDashboardData;
