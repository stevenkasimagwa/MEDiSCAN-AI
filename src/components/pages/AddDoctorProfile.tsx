import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Save, Loader2, User, Key } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { apiService } from '@/services/apiService';

interface AddDoctorProfileProps {
  onBack: () => void;
  onSuccess: () => void;
}

export const AddDoctorProfile = ({ onBack, onSuccess }: AddDoctorProfileProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    name: '',
    username: '',
    password: '',
    role: 'doctor'
  });

  const handleChange = (key: string, value: string) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Create doctor profile via admin API (avoid using signUp which logs in)
      const created = await apiService.request('/doctors', {
        method: 'POST',
        body: JSON.stringify({
          name: formData.name,
          username: formData.username,
          password: formData.password,
          role: formData.role
        })
      });

  // Log audit event
  await apiService.createAuditLog({ user_id: apiService.getCurrentUser()?.id || null, action: 'CREATE', details: `Created user: ${formData.name} (${formData.username})`, resource_type: 'user', resource_id: created?.doctor?.id || null });

      toast({
        title: "Success",
        description: `Doctor profile for ${formData.name} created successfully`,
      });

      onSuccess();
    } catch (error: any) {
      console.error('Error creating doctor profile:', error);
      toast({
        title: "Error",
        description: error?.message || "Failed to create doctor profile",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <h1 className="text-2xl sm:text-3xl font-bold">Add Doctor Profile</h1>
      </div>

      {/* Form Card */}
      <Card>
        <CardHeader>
          <CardTitle>Create New Doctor Account</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Full Name */}
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

            {/* Password */}
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <div className="absolute inset-y-0 left-3 hidden md:flex items-center h-full text-muted-foreground"><Key className="h-4 w-4" /></div>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter password"
                     className="pl-3 md:pl-12"
                  value={formData.password}
                  onChange={(e) => handleChange('password', e.target.value)}
                  required
                  minLength={6}
                />
              </div>
            </div>

            {/* Role */}
            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Select
                value={formData.role}
                onValueChange={(value) => handleChange('role', value)}
              >
                <SelectTrigger className="w-full md:w-56">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="doctor">Doctor</SelectItem>
                  <SelectItem value="admin">Administrator</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Submit Button */}
            <Button type="submit" className="w-full md:w-auto" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating Account...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Create Doctor Profile
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};
