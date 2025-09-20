import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Search, Plus, Edit, Trash2, MoreVertical, ArrowLeft } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { apiService } from '@/services/apiService';

interface Doctor {
  id: string;
  user_id?: string;
  doctor_name: string;
  username: string;
  role: 'admin' | 'doctor';
  created_at: string;
}

interface ViewDoctorProfilesProps {
  onBack: () => void;
  onEdit: (doctor: Doctor) => void;
  onAdd: () => void;
  onRefresh?: () => void;
}

export const ViewDoctorProfiles = ({ onBack, onEdit, onAdd }: ViewDoctorProfilesProps) => {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => { fetchDoctors(); }, []);

  const fetchDoctors = async () => {
    setLoading(true);
    try {
      const data: any[] = await apiService.getDoctorProfiles();
      const normalized = data.map(d => ({
        id: d.id || d.user_id || d.userId || d.users_id || d.userId,
        user_id: d.id || d.user_id || d.userId || d.users_id,
        doctor_name: d.doctor_name || d.name || d.doctorName || d.doctor_name || '',
        username: d.username || d.userName || d.user_name || '',
        role: String(d.role || 'doctor').toLowerCase() as 'admin' | 'doctor',
        created_at: d.created_at || d.createdAt || new Date().toISOString()
      }));
      setDoctors(normalized);
    } catch (error) {
      console.error('Error fetching doctors:', error);
      toast({ title: 'Error', description: 'Failed to fetch doctor profiles', variant: 'destructive' });
    } finally { setLoading(false); }
  };

  const handleDelete = async (doctor: Doctor) => {
    if (!confirm(`Are you sure you want to delete ${doctor.doctor_name}?`)) return;
    try {
      await apiService.deleteDoctorProfile(doctor.id);
      await apiService.createAuditLog({ user_id: apiService.getCurrentUser()?.id || null, action: 'DELETE', details: `Deleted user: ${doctor.doctor_name} (${doctor.username})`, resource_type: 'user', resource_id: doctor.id });
      toast({ title: 'Success', description: 'User deleted successfully' });
      fetchDoctors();
    } catch (error) {
      console.error('Error deleting doctor:', error);
      toast({ title: 'Error', description: 'Failed to delete user', variant: 'destructive' });
    }
  };

  const filteredDoctors = doctors.filter(
    (d) => d.doctor_name.toLowerCase().includes(searchTerm.toLowerCase()) || d.username.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={onBack}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <h1 className="text-3xl font-bold">Users</h1>
        </div>
        <Button onClick={onAdd}>
          <Plus className="mr-2 h-4 w-4" />
          Add User
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="relative max-w-sm">
            <div className="absolute inset-y-0 left-3 hidden md:flex items-center h-full text-muted-foreground"><Search className="h-4 w-4" /></div>
            <Input placeholder="Search users..." className="pl-3 md:pl-12" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>
          ) : (
            <>
              <div className="md:hidden space-y-3">
                {filteredDoctors.length === 0 ? (
                  <div className="text-center text-muted-foreground">No users found</div>
                ) : (
                  filteredDoctors.map((doctor) => (
                    <div key={doctor.id} className="p-3 border rounded bg-background flex items-start justify-between">
                      <div>
                        <div className="font-medium">{doctor.doctor_name}</div>
                        <div className="text-sm text-muted-foreground">{doctor.username}</div>
                        <div className="mt-2"><Badge variant={doctor.role === 'admin' ? 'default' : 'secondary'}>{doctor.role}</Badge></div>
                        <div className="mt-1 text-xs text-muted-foreground">{new Date(doctor.created_at).toLocaleDateString()}</div>
                      </div>
                      <div className="ml-3 flex-shrink-0">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm"><MoreVertical className="h-4 w-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent>
                            <DropdownMenuItem onClick={() => onEdit(doctor)}><Edit className="mr-2 h-4 w-4" />Edit</DropdownMenuItem>
                            {doctor.username !== 'admin' && (<DropdownMenuItem onClick={() => handleDelete(doctor)} className="text-destructive"><Trash2 className="mr-2 h-4 w-4" />Delete</DropdownMenuItem>)}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Username</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredDoctors.length === 0 ? (
                      <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">No users found</TableCell></TableRow>
                    ) : (
                      filteredDoctors.map((doctor) => (
                        <TableRow key={doctor.id}>
                          <TableCell className="font-medium">{doctor.doctor_name}</TableCell>
                          <TableCell>{doctor.username}</TableCell>
                          <TableCell><Badge variant={doctor.role === 'admin' ? 'default' : 'secondary'}>{doctor.role}</Badge></TableCell>
                          <TableCell>{new Date(doctor.created_at).toLocaleDateString()}</TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm"><MoreVertical className="h-4 w-4" /></Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent>
                                <DropdownMenuItem onClick={() => onEdit(doctor)}><Edit className="mr-2 h-4 w-4" />Edit</DropdownMenuItem>
                                {doctor.username !== 'admin' && (<DropdownMenuItem onClick={() => handleDelete(doctor)} className="text-destructive"><Trash2 className="mr-2 h-4 w-4" />Delete</DropdownMenuItem>)}
                              </DropdownMenuContent>
                            </DropdownMenu>
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
    </div>
  );
    };
