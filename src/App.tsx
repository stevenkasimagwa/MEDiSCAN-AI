import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { RecordsProvider } from "@/context/RecordsContext";
import Index from "./pages/Index";
import { PatientSearch } from '@/components/PatientSearch';
import NotFound from "./pages/NotFound";
import RecordPage from "./pages/RecordPage";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
  <RecordsProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/record/:patientId" element={<RecordPage />} />
            <Route path="/search" element={<PatientSearch />} />
            <Route path="/search/advanced" element={<PatientSearch />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
  </RecordsProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
