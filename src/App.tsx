import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";

import Index from "./pages/Index";
import Admin from "./pages/Admin";
import Profile from "./pages/Profile";
import Spectate from "./pages/Spectate";
import NotFound from "./pages/NotFound";
import Community from "./pages/Community";
import { UsernameModal } from "@/components/UsernameModal";
import { ChatPanel } from "@/components/ChatPanel";
import { useUiStore } from "@/store/uiStore";

const queryClient = new QueryClient();

// Global chat panel wrapper — available on all pages when logged in
function GlobalChatPanel() {
  const { user } = useAuth();
  const { selectedRoomId } = useUiStore();
  if (!user) return null;
  return <ChatPanel roomId={selectedRoomId} />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <UsernameModal />
        <BrowserRouter>
          <GlobalChatPanel />
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/profile/:uid" element={<Profile />} />
            <Route path="/spectate/:roomId" element={<Spectate />} />
            <Route path="/community" element={<Community />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
