import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { HouseholdProvider, useHousehold } from "@/context/HouseholdContext";
import SetupPage from "./pages/SetupPage";
import TodayPage from "./pages/TodayPage";
import DashboardPage from "./pages/DashboardPage";
import TasksPage from "./pages/TasksPage";
import SettingsPage from "./pages/SettingsPage";
import RewardsPage from "./pages/RewardsPage";
import ShoppingPage from "./pages/ShoppingPage";
import AppLayout from "./components/AppLayout";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const AppRoutes = () => {
  const { householdId, currentMember } = useHousehold();

  if (!householdId || !currentMember) {
    return <SetupPage />;
  }

  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={<TodayPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/tasks" element={<TasksPage />} />
        <Route path="/rewards" element={<RewardsPage />} />
        <Route path="/shopping" element={<ShoppingPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AppLayout>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <HouseholdProvider>
          <AppRoutes />
        </HouseholdProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
