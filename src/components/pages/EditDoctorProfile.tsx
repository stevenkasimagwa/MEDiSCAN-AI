import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Save, Loader2, User } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { apiService } from '@/services/apiService';

interface Doctor {
  id: string;
  user_id: string;
  doctor_name: string;
  username: string;
  role: 'admin' | 'doctor';
  created_at: string;
}

interface EditDoctorProfileProps {
  doctor: Doctor;
  onBack: () => void;
  onSuccess: () => void;
}

export const EditDoctorProfile = ({ doctor, onBack, onSuccess }: EditDoctorProfileProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    name: doctor.doctor_name,
    username: doctor.username,
    role: doctor.role
  });

  const handleChange = (key: string, value: string) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const targetId = doctor.user_id || doctor.id;
      await apiService.updateDoctorProfile(targetId, formData);

  await apiService.createAuditLog({ user_id: apiService.getCurrentUser()?.id || null, action: 'UPDATE', details: JSON.stringify({ resource: 'user', resource_id: targetId, old: { name: doctor.doctor_name, username: doctor.username, role: doctor.role }, new: formData }) });

      toast({
        title: "Success",
        description: "Doctor profile updated successfully",
      });

      onSuccess();
    } catch (error: any) {
      console.error('Error updating doctor profile:', error);
      toast({
        title: "Error",
        description: error?.message || "Failed to update doctor profile",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <h1 className="text-3xl font-bold">Edit Doctor Profile</h1>
      </div>

      {/* Form Card */}
      <Card>
        <CardHeader>
          <CardTitle>Update Doctor Information</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <div className="relative">
                  <div className="absolute inset-y-0 left-3 hidden md:flex items-center h-full text-muted-foreground"><User className="h-4 w-4" /></div>
                  <Input
                    id="name"
                    placeholder="Dr. John Smith"
                    className="pl-3 md:pl-12"
                  value={formData.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Username */}
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <div className="relative">
                <div className="absolute inset-y-0 left-3 hidden md:flex items-center h-full text-muted-foreground"><User className="h-4 w-4" /></div>
                <div className="absolute inset-y-0 left-3 hidden md:flex items-center h-full text-muted-foreground"><User className="h-4 w-4" /></div>
                <Input
                  id="username"
                  placeholder="john.smith"
                  className="pl-3 md:pl-12"
                  value={formData.username}
                  onChange={(e) => handleChange('username', e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Role */}
            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Select
                value={formData.role}
                onValueChange={(value) => handleChange('role', value as 'admin' | 'doctor')}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="doctor">Doctor</SelectItem>
                  <SelectItem value="admin">Administrator</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Submit */}
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating Profile...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Update Profile
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};
