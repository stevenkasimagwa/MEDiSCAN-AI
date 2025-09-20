import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Search, Activity, Filter } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { apiService } from '@/services/apiService';
import { timeAgo } from '@/lib/timeAgo';

interface AuditLog {
  id: string;
  action: string;
  details?: any;
  created_at?: string;
  profiles?: { doctor_name?: string; username?: string } | null;
}

export const AuditLogs: React.FC<{ onBack?: () => void }> = ({ onBack }) => {
  const { toast } = useToast();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [timeFilter, setTimeFilter] = useState<string>('all');

  const fetchAuditLogs = async () => {
    setLoading(true);
    try {
      const res = await apiService.getAuditLogs();
      setLogs(Array.isArray(res) ? res : []);
    } catch (err) {
      console.error('Failed to fetch audit logs', err);
      toast({ title: 'Error', description: 'Failed to load audit logs', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAuditLogs(); }, []);

  const copyDetails = (details?: any) => {
    try {
      const text = typeof details === 'string' ? details : JSON.stringify(details || {});
      navigator.clipboard?.writeText(text);
      toast({ title: 'Copied', description: 'Details copied to clipboard' });
    } catch (e) {
      toast({ title: 'Error', description: 'Failed to copy', variant: 'destructive' });
    }
  };

  const handleDeleteLog = async (id: string) => {
    if (!confirm('Delete this audit log entry? This action cannot be undone.')) return;
    try {
      await apiService.deleteAuditLog(id);
      toast({ title: 'Deleted', description: 'Audit log entry deleted' });
      fetchAuditLogs();
    } catch (err) {
      console.error('Failed to delete audit log', err);
      toast({ title: 'Error', description: 'Failed to delete audit log', variant: 'destructive' });
    }
  };

  const handleClearAll = async () => {
    if (!confirm('Clear ALL audit logs? This action cannot be undone.')) return;
    try {
      for (const l of logs) {
        try { await apiService.deleteAuditLog(l.id); } catch (e) { console.warn('Failed to delete log', l.id, e); }
      }
      toast({ title: 'Cleared', description: 'All audit logs have been deleted' });
      fetchAuditLogs();
    } catch (err) {
      console.error('Failed to clear logs', err);
      toast({ title: 'Error', description: 'Failed to clear logs', variant: 'destructive' });
    }
  };

  const handleDeleteRange = async (range: '1d' | '7d' | '30d') => {
    if (!confirm(`Delete logs from the last ${range === '1d' ? 'day' : range === '7d' ? '7 days' : '30 days'}? This action cannot be undone.`)) return;
    try {
      const now = Date.now();
      const cutoff = now - (range === '1d' ? 24*60*60*1000 : range === '7d' ? 7*24*60*60*1000 : 30*24*60*60*1000);
      const toDelete = logs.filter(l => {
        try { return new Date(l.created_at || '').getTime() >= cutoff; } catch { return false; }
      });
      for (const l of toDelete) {
        try { await apiService.deleteAuditLog(l.id); } catch (e) { console.warn('Failed to delete log', l.id, e); }
      }
      toast({ title: 'Deleted', description: `${toDelete.length} logs deleted` });
      fetchAuditLogs();
    } catch (err) {
      console.error('Failed to delete range', err);
      toast({ title: 'Error', description: 'Failed to delete logs', variant: 'destructive' });
    }
  };

  const getActionBadge = (action: string) => {
    const colors: Record<string, 'default' | 'secondary' | 'destructive'> = {
      CREATE: 'default',
      UPDATE: 'secondary',
      DELETE: 'destructive',
      LOGIN: 'default',
      LOGOUT: 'secondary',
    };
    return <Badge variant={colors[action] || 'secondary'}>{action}</Badge>;
  };

  const filteredLogs = logs.filter(log => {
    const q = (searchTerm || '').toLowerCase();
    const profileName = (log.profiles?.doctor_name || '').toString().toLowerCase();
    const profileUsername = (log.profiles?.username || '').toString().toLowerCase();
    const action = (log.action || '').toString().toLowerCase();

    let matchesSearch = false;
    if (!q) matchesSearch = true;
    else {
      const detailsStr = (typeof log.details === 'string') ? log.details : JSON.stringify(log.details || {});
      matchesSearch = profileName.includes(q) || profileUsername.includes(q) || action.includes(q) || detailsStr.toLowerCase().includes(q);
    }

    const matchesAction = actionFilter === 'all' || (log.action === actionFilter);

    let matchesTime = true;
    try {
      if (timeFilter !== 'all' && log.created_at) {
        const now = new Date();
        const created = new Date(log.created_at);
        const diffMs = now.getTime() - created.getTime();
        if (timeFilter === '5m') matchesTime = diffMs <= 5 * 60 * 1000;
        if (timeFilter === '30m') matchesTime = diffMs <= 30 * 60 * 1000;
        if (timeFilter === '1h') matchesTime = diffMs <= 60 * 60 * 1000;
      }
    } catch (e) { matchesTime = true; }

    return matchesSearch && matchesAction && matchesTime;
  });

  filteredLogs.sort((a, b) => new Date(b.created_at || '').getTime() - new Date(a.created_at || '').getTime());

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        <h1 className="text-2xl sm:text-3xl font-bold">Audit Logs</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="relative">
              <div className="absolute inset-y-0 left-3 hidden md:flex items-center h-full text-muted-foreground pointer-events-none"><Search className="h-4 w-4" /></div>
              <Input placeholder="Search logs..." className="pl-3 md:pl-12" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex flex-col md:flex-row items-start md:items-center gap-2">
            <div className="flex items-center gap-2 w-full md:w-auto">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={actionFilter} onValueChange={(v) => setActionFilter(String(v))}>
                <SelectTrigger className="w-full md:w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Actions</SelectItem>
                  <SelectItem value="CREATE">Create</SelectItem>
                  <SelectItem value="UPDATE">Update</SelectItem>
                  <SelectItem value="DELETE">Delete</SelectItem>
                  <SelectItem value="LOGIN">Login</SelectItem>
                  <SelectItem value="LOGOUT">Logout</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="mt-2 md:mt-0 md:ml-4 w-full md:w-auto">
              <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                <span className="text-sm text-muted-foreground">Time:</span>
                <Select value={timeFilter} onValueChange={(v) => setTimeFilter(String(v))}>
                  <SelectTrigger className="w-full sm:w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="5m">Last 5 minutes</SelectItem>
                    <SelectItem value="30m">Last 30 minutes</SelectItem>
                    <SelectItem value="1h">Last hour</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex flex-col md:flex-row items-start md:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              <span>System Activity ({filteredLogs.length})</span>
            </div>
            <div className="flex items-center gap-2 flex-wrap justify-end">
              <Button size="sm" variant="ghost" onClick={() => handleDeleteRange('1d')}>Delete last day</Button>
              <Button size="sm" variant="ghost" onClick={() => handleDeleteRange('7d')}>Delete last 7 days</Button>
              <Button size="sm" variant="ghost" onClick={() => handleDeleteRange('30d')}>Delete last 30 days</Button>
              <Button size="sm" variant="destructive" onClick={handleClearAll}>Clear all</Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Mobile stacked cards */}
          <div className="md:hidden space-y-3">
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : (
              filteredLogs.length === 0 ? (
                <div className="text-center text-muted-foreground">No audit logs found</div>
              ) : (
                filteredLogs.map(log => (
                  <div key={log.id} className="p-3 border rounded bg-background break-words">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="font-medium">{log.profiles?.doctor_name || 'Unknown'}</div>
                        <div className="text-sm text-muted-foreground">{log.profiles?.username || '-'}</div>
                        <div className="mt-1 text-sm">{getActionBadge(log.action)}</div>
                        <div className="mt-2 text-sm break-words">
                          {log.details ? (
                            (() => {
                              let detailsObj: any = log.details;
                              if (typeof detailsObj === 'string') {
                                try { detailsObj = JSON.parse(detailsObj); } catch (e) { return <div className="text-sm">{detailsObj}</div>; }
                              }
                              if (typeof detailsObj === 'object' && detailsObj !== null) {
                                return <div className="text-sm">{Object.entries(detailsObj).map(([k,v]) => <div key={k} className="break-words"><span className="font-medium">{k}:</span> {String(v)}</div>)}</div>;
                              }
                              return <div className="text-sm">{String(detailsObj)}</div>;
                            })()
                          ) : '-'}
                        </div>
                        <div className="mt-2 text-xs text-muted-foreground">{log.created_at ? timeAgo(log.created_at) : '-'}</div>
                      </div>
                      <div className="ml-3 flex-shrink-0 flex flex-col items-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => copyDetails(log.details)}>Copy</Button>
                        <Button variant="destructive" size="sm" onClick={() => handleDeleteLog(log.id)}>Delete</Button>
                      </div>
                    </div>
                  </div>
                ))
              )
            )}
          </div>

          {/* Desktop/table: table with horizontal scroll when needed */}
          <div className="hidden md:block overflow-x-auto">
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : (
              <Table className="min-w-[72rem]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Doctor</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Details</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">No audit logs found</TableCell>
                    </TableRow>
                  ) : (
                    filteredLogs.map(log => (
                      <TableRow key={log.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{log.profiles?.doctor_name || 'Unknown'}</p>
                            <p className="text-sm text-muted-foreground">{log.profiles?.username || '-'}</p>
                          </div>
                        </TableCell>
                        <TableCell>{getActionBadge(log.action)}</TableCell>
                        <TableCell className="max-w-2xl break-words">
                          {log.details ? (
                            (() => {
                              let detailsObj: any = log.details;
                              if (typeof detailsObj === 'string') {
                                try { detailsObj = JSON.parse(detailsObj); } catch (e) { return <div className="text-sm">{detailsObj}</div>; }
                              }
                              if (typeof detailsObj === 'object' && detailsObj !== null) {
                                return (
                                  <div className="text-sm">
                                    {Object.entries(detailsObj).map(([key, value]) => (
                                      <div key={key} className="break-words">
                                        <span className="font-medium">{key}:</span> {String(value)}
                                      </div>
                                    ))}
                                  </div>
                                );
                              }
                              return <div className="text-sm">{String(detailsObj)}</div>;
                            })()
                          ) : '-'}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm text-muted-foreground">{log.created_at ? timeAgo(log.created_at) : '-'}</div>
                          <div className="text-xs text-muted-foreground">{log.created_at ? new Date(log.created_at).toLocaleString() : ''}</div>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button variant="ghost" size="sm" onClick={() => copyDetails(log.details)}>Copy</Button>
                            <Button variant="destructive" size="sm" onClick={() => handleDeleteLog(log.id)}>Delete</Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
