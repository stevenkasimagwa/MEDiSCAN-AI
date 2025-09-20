import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { apiService } from '@/services/apiService';

interface Props {
  open: boolean;
  onClose: () => void;
  onDelete: () => void;
}

export const DeleteAccountDialog: React.FC<Props> = ({ open, onClose, onDelete }) => {
  const { toast } = useToast();
  const [loading, setLoading] = React.useState(false);

  const handleDelete = async () => {
    if (loading) return;
    setLoading(true);
    try {
      await apiService.deleteAccount();
      toast({ title: 'Account deleted', description: 'Your account was deleted' });
      onDelete();
    } catch (err) {
      console.error('Delete account failed', err);
      toast({ title: 'Error', description: 'Failed to delete account', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Account</DialogTitle>
        </DialogHeader>
        <p>Are you sure you want to delete your account? This action cannot be undone.</p>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button variant="destructive" onClick={handleDelete} disabled={loading}>{loading ? 'Deleting...' : 'Delete'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default DeleteAccountDialog;
