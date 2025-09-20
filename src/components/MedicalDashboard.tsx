import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Users,
  AlertTriangle,
  Activity,
  Search,
  TrendingUp,
  Heart,
  Stethoscope,
  FileText,
  Plus,
  Calendar,
  Filter
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/components/ui/use-toast';

interface MedicalRecord {
  id: string;
  patient_id: string;
  patient_name: string;
  age: number | null;
  gender: string | null;
  date_recorded: string;
  diagnosis: string | null;
  prescription: string | null;
  created_at: string;
}

export const MedicalDashboard = ({ records: initialRecords, onNavigateToSearch, onNavigateToAnalytics }: { records?: MedicalRecord[]; onNavigateToSearch?: () => void; onNavigateToAnalytics?: () => void }) => {
  const { user, doctorName } = useAuth();
  const { toast } = useToast();
  const [records, setRecords] = useState<MedicalRecord[]>(initialRecords || []);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading] = useState(false);

  const today = new Date().toISOString().split('T')[0];
  const thisWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const thisMonth = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const todayRecords = records.filter(r => r.date_recorded === today);
  const weekRecords = records.filter(r => r.date_recorded >= thisWeek);
  const monthRecords = records.filter(r => r.date_recorded >= thisMonth);
  const recentPatients = records.slice(0, 8);

  const highRiskPatients = records
    .filter(r => r.diagnosis?.toLowerCase().match(/diabetes|hypertension|cardiac|heart/))
    .slice(0, 5);
  // counts by diagnosis for analytics/trends
  const diagnosisCounts = records.reduce<Record<string, number>>((acc, r) => {
    if (r.diagnosis) {
      const key = r.diagnosis.toLowerCase();
      acc[key] = (acc[key] || 0) + 1;
    }
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6 flex items-center gap-2">
            <Calendar className="h-5 w-5 text-blue-500" />
            <div>
              <p className="text-sm text-muted-foreground">Today's Records</p>
              <p className="text-2xl font-bold">{todayRecords.length}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6 flex items-center gap-2">
            <Users className="h-5 w-5 text-green-500" />
            <div>
              <p className="text-sm text-muted-foreground">This Month</p>
              <p className="text-2xl font-bold">{monthRecords.length}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          {/* Make the whole card clickable: View All Records */}
          <div
            role="button"
            tabIndex={0}
            onClick={() => { if (onNavigateToSearch) onNavigateToSearch(); else window.location.href = '/records'; }}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { if (onNavigateToSearch) onNavigateToSearch(); else window.location.href = '/records'; } }}
            className="cursor-pointer"
          >
            <CardContent className="p-6 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-indigo-500" />
                <div>
                  <p className="text-sm text-muted-foreground">View All Records</p>
                  <p className="text-2xl font-bold">{records.length}</p>
                </div>
              </div>
            </CardContent>
          </div>
        </Card>

        <Card>
          <CardContent className="p-6 flex items-center gap-2">
            <FileText className="h-5 w-5 text-purple-500" />
            <div>
              <p className="text-sm text-muted-foreground">Total Records</p>
              <p className="text-2xl font-bold">{records.length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent & Search */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" /> Recent Patient Records
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {recentPatients.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No patient records yet</p>
                  <p className="text-sm">Start by scanning or creating your first record</p>
                </div>
              ) : recentPatients.map(patient => (
                <div
                  key={patient.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => { window.location.href = `/record/${patient.id}`; }}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') window.location.href = `/record/${patient.id}`; }}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 cursor-pointer"
                >
                  <div>
                    <p className="font-medium">{patient.patient_name}</p>
                    <p className="text-sm text-muted-foreground">
                      ID: {patient.patient_id}{patient.age && ` • ${patient.age}y`}{patient.gender && ` • ${patient.gender}`}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">{new Date(patient.date_recorded).toLocaleDateString()}</p>
                    {patient.diagnosis && <Badge variant="outline" className="text-xs mt-1">{patient.diagnosis.length > 25 ? `${patient.diagnosis.slice(0,25)}...` : patient.diagnosis}</Badge>}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" /> Search
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Use the Search page for quick and advanced searches.</p>
              <Button variant="outline" onClick={() => { if (onNavigateToSearch) onNavigateToSearch(); window.location.href = '/search/advanced'; }}>Go to Search</Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Record Statistics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div
          role="button"
          tabIndex={0}
          onClick={() => { if (onNavigateToAnalytics) onNavigateToAnalytics(); else window.location.href = '/analytics'; }}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { if (onNavigateToAnalytics) onNavigateToAnalytics(); else window.location.href = '/analytics'; } }}
          className="cursor-pointer"
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Activity className="h-5 w-5" /> Record Statistics</CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="overview" className="space-y-4">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="trends">Trends</TabsTrigger>
                </TabsList>
                <TabsContent value="overview" className="space-y-3">
                  <div className="p-3 border rounded-lg">
                    <div className="flex items-center gap-2 mb-2"><TrendingUp className="h-4 w-4 text-green-500" /><span className="font-medium">Records This Week</span></div>
                    <p className="text-2xl font-bold">{weekRecords.length}</p>
                    <p className="text-sm text-muted-foreground">Patient records created</p>
                  </div>
                  {/* Unique Patients block removed per design */}
                </TabsContent>
                <TabsContent value="trends" className="space-y-3">
                  <div className="p-3 border rounded-lg">
                    <div className="flex items-center gap-2 mb-2"><Stethoscope className="h-4 w-4 text-purple-500" /><span className="font-medium">Most Common Conditions</span></div>
                    {Object.entries(diagnosisCounts).slice(0,3).map(([condition,count])=>(
                      <div key={condition} className="flex justify-between text-sm">
                        <span className="capitalize">{condition}</span>
                        <span className="font-medium">{count}</span>
                      </div>
                    ))}
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>
      {/* Quick Actions removed per design */}
    </div>
  );
};
