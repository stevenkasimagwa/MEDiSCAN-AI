import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useAuth } from '@/hooks/useAuth';
import { useRecords } from '@/context/RecordsContext';
import { apiService } from '@/services/apiService';
import { 
  Users, 
  Calendar, 
  TrendingUp, 
  Heart, 
  Activity,
  AlertTriangle,
  PieChart,
  BarChart3
} from 'lucide-react';

interface MedicalRecord {
  id: string;
  patient_id: string;
  patient_name: string;
  age?: number;
  sex?: string;
  diagnosis?: string;
  date_recorded?: string;
  created_at?: string;
}

interface AnalyticsData {
  totalPatients: number;
  recordsThisMonth: number;
  commonDiagnoses: { diagnosis: string; count: number }[];
  ageDistribution: { range: string; count: number }[];
  genderDistribution: { gender: string; count: number }[];
  avgAge: number;
}

export const MedicalAnalytics = ({ records: initialRecords }: { records?: MedicalRecord[] }) => {
  const { user } = useAuth();
  const { records: ctxRecords, fetchRecords, loading } = useRecords();

  // If parent provided initialRecords, we can use them; otherwise fetch fresh records from server
  useEffect(() => {
    if (initialRecords && initialRecords.length) return;
    fetchRecords().catch(err => console.error('Failed to fetch records for analytics', err));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialRecords]);

  const records = initialRecords && initialRecords.length ? initialRecords : ctxRecords;

  const [serverTotalPatients, setServerTotalPatients] = useState<number | undefined>(undefined);
  const [serverDiagnoses, setServerDiagnoses] = useState<{ diagnosis: string; count: number }[] | undefined>(undefined);

  // Load server-side analytics (total patients, diagnoses counts) and prefer these numbers when available
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const data = await apiService.getAnalytics();
        if (!mounted) return;
        setServerTotalPatients(data.total_patients || 0);
        setServerDiagnoses(data.diagnoses || []);
      } catch (err) {
        console.warn('Failed to fetch server analytics', err);
      }
    };
    load();
    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const analytics: AnalyticsData = useMemo(() => {
    if (!records || !records.length) return {
      totalPatients: 0,
      recordsThisMonth: 0,
      commonDiagnoses: [],
      ageDistribution: [],
      genderDistribution: [],
      avgAge: 0,
    };

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const recordsThisMonth = records.filter(r => {
      const dateStr = r.date_recorded || r.created_at || '';
      const date = new Date(dateStr);
      if (Number.isNaN(date.getTime())) return false;
      return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
    }).length;

    const totalPatients = new Set(records.map(r => (r.patient_id || '').toString())).size;

    // Common Diagnoses
    const diagCount: Record<string, number> = {};
    records.forEach(r => {
      if (r.diagnosis) {
        const key = r.diagnosis.toLowerCase().trim();
        diagCount[key] = (diagCount[key] || 0) + 1;
      }
    });
    const commonDiagnoses = Object.entries(diagCount)
      .map(([diagnosis, count]) => ({ diagnosis, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Age Distribution
    const ageRanges = { '0-18': 0, '19-35': 0, '36-50': 0, '51-65': 0, '65+': 0 };
    let ageSum = 0;
    let ageCount = 0;
    records.forEach(r => {
      if (r.age === undefined || r.age === null) return;
      const age = Number(r.age);
      if (Number.isNaN(age)) return;
      ageSum += age;
      ageCount++;
      if (age <= 18) ageRanges['0-18']++;
      else if (age <= 35) ageRanges['19-35']++;
      else if (age <= 50) ageRanges['36-50']++;
      else if (age <= 65) ageRanges['51-65']++;
      else ageRanges['65+']++;
    });
    const ageDistribution = Object.entries(ageRanges).map(([range, count]) => ({ range, count }));

    // Gender/Sex Distribution
    const genderCount: Record<string, number> = {};
    records.forEach(r => {
      const g = (r.sex || r['gender'] || '').toString().trim();
      if (!g) return;
      genderCount[g] = (genderCount[g] || 0) + 1;
    });
    const genderDistribution = Object.entries(genderCount).map(([gender, count]) => ({ gender, count }));

    const avgAge = ageCount > 0 ? Math.round(ageSum / ageCount) : 0;

    return { totalPatients, recordsThisMonth, commonDiagnoses, ageDistribution, genderDistribution, avgAge };
  }, [records]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[...Array(6)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6">
              <div className="h-20 bg-muted rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card>
          <CardContent className="p-6 flex justify-between items-center">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total Patients</p>
                <p className="text-3xl font-bold">{typeof serverTotalPatients === 'number' ? serverTotalPatients : analytics.totalPatients}</p>
            </div>
            <Users className="h-8 w-8 text-primary" />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6 flex justify-between items-center">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Records This Month</p>
              <p className="text-3xl font-bold">{analytics.recordsThisMonth}</p>
            </div>
            <Calendar className="h-8 w-8 text-primary" />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6 flex justify-between items-center">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Avg Age</p>
              <p className="text-3xl font-bold">{analytics.avgAge}</p>
            </div>
            <Activity className="h-8 w-8 text-primary" />
          </CardContent>
        </Card>
      </div>

      {/* Detailed Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Common Diagnoses */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" /> Common Diagnoses
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {(Array.isArray(serverDiagnoses) ? serverDiagnoses.slice(0,5) : analytics.commonDiagnoses).map((item: any, i: number) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-medium capitalize">{item.diagnosis}</p>
                    <Progress value={(item.count / (typeof serverTotalPatients === 'number' ? serverTotalPatients : analytics.totalPatients)) * 100} className="mt-1" />
                  </div>
                  <Badge variant="secondary" className="ml-3">{item.count}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Age Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChart className="h-5 w-5" /> Age Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {analytics.ageDistribution.map((item, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-medium">{item.range} years</p>
                    <Progress value={(item.count / analytics.totalPatients) * 100} className="mt-1" />
                  </div>
                  <Badge variant="outline" className="ml-3">{item.count}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Gender Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" /> Gender Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {analytics.genderDistribution.map((item, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-medium">{item.gender}</p>
                    <Progress value={(item.count / analytics.totalPatients) * 100} className="mt-1" />
                  </div>
                  <Badge variant="outline" className="ml-3">{item.count}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Quick Insights */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" /> Quick Insights
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm font-medium">Most Common Age Group</p>
              <p className="text-xs text-muted-foreground">
                {[...analytics.ageDistribution].sort((a,b)=>b.count-a.count)[0]?.range || 'N/A'} years
              </p>
            </div>
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm font-medium">Top Diagnosis</p>
              <p className="text-xs text-muted-foreground capitalize">
                {(Array.isArray(serverDiagnoses) ? serverDiagnoses[0]?.diagnosis : analytics.commonDiagnoses[0]?.diagnosis) || 'N/A'}
              </p>
            </div>
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm font-medium">Monthly Activity</p>
              <p className="text-xs text-muted-foreground">{analytics.recordsThisMonth} records this month</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
