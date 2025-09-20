import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Auth } from '@/components/Auth';
import { Dashboard } from '@/components/Dashboard';
import { AdminDashboard } from '@/components/AdminDashboard';
import { Scanner } from '@/components/Scanner';
import { RecordForm } from '@/components/RecordForm';
import { isAdmin } from '@/hooks/roleUtils';

type AppState = 'dashboard' | 'scanning' | 'reviewing';

const Index = () => {
  const { user, loading, userRole } = useAuth();
  const [appState, setAppState] = useState<AppState>('dashboard');
  const [extractedData, setExtractedData] = useState<{
    text: string;
    imageUrl: string;
  } | null>(null);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return <Auth />;
  }

  const handleExtracted = (text: string, imageUrl: string) => {
    setExtractedData({ text, imageUrl });
    setAppState('reviewing');
  };

  const handleSaved = () => {
    setAppState('dashboard');
    setExtractedData(null);
  };

  const handleBack = () => {
    if (appState === 'reviewing') {
      setAppState('scanning');
    } else {
      setAppState('dashboard');
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {appState === 'dashboard' && isAdmin(userRole) && (
        <AdminDashboard />
      )}
      
      {appState === 'dashboard' && !isAdmin(userRole) && (
        <Dashboard onNewScan={() => setAppState('scanning')} />
      )}
      
      {appState === 'scanning' && (
        <div className="min-h-screen flex items-center justify-center p-4">
          <Scanner onExtracted={handleExtracted} onBack={handleBack} />
        </div>
      )}
      
      {appState === 'reviewing' && extractedData && (
        <div className="p-4">
          <RecordForm
            extractedText={extractedData.text}
            imageUrl={extractedData.imageUrl}
            onSaved={handleSaved}
            onBack={handleBack}
          />
        </div>
      )}
    </div>
  );
};

export default Index;
