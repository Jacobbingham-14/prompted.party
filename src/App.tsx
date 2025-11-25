import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import Landing from "./pages/Landing";
import Index from "./pages/Index";
import Join from "./pages/Join";
import Auth from "./pages/Auth";
import PromptsManager from "./pages/PromptsManager";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

// Main app component with routing

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/play" element={<Index />} />
          <Route path="/join" element={<Join />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/prompts-manager" element={<PromptsManager />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
