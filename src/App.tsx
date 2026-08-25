import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "@/features/auth/AuthContext";
import { ToastProvider } from "@/components/Toast";
import { CommandBarProvider } from "@/features/command-bar/CommandBarContext";
import { CommandBar } from "@/features/command-bar/CommandBar";
import { AppShell } from "@/components/AppShell";
import { Spinner } from "@/components/Spinner";
import LoginPage from "@/pages/LoginPage";
import OnboardingPage from "@/pages/OnboardingPage";
import TodayPage from "@/pages/TodayPage";
import ProjectsPage from "@/pages/ProjectsPage";
import ProjectDetailPage from "@/pages/ProjectDetailPage";
import TimelinePage from "@/pages/TimelinePage";
import ContextPage from "@/pages/ContextPage";
import SettingsPage from "@/pages/SettingsPage";
import InboxPage from "@/pages/InboxPage";
import { applyTheme, getStoredThemePreference, watchSystemTheme } from "@/lib/theme";

const ONBOARDED_KEY = "intellitask.onboarded";

function FullPageSpinner() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <Spinner className="h-6 w-6" />
    </div>
  );
}

function ProtectedLayout() {
  const { username, loading } = useAuth();
  const location = useLocation();
  const [onboarded, setOnboarded] = useState(
    () => localStorage.getItem(ONBOARDED_KEY) === "true",
  );

  if (loading) return <FullPageSpinner />;
  if (!username) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }
  if (!onboarded) {
    return (
      <OnboardingPage
        onDone={() => {
          localStorage.setItem(ONBOARDED_KEY, "true");
          setOnboarded(true);
        }}
      />
    );
  }

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}

function PublicOnlyRoute({ children }: { children: ReactNode }) {
  const { username, loading } = useAuth();
  if (loading) return <FullPageSpinner />;
  if (username) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function useThemeSync() {
  useEffect(() => {
    const pref = getStoredThemePreference();
    applyTheme(pref);
    const unwatch = watchSystemTheme(() => {
      if (getStoredThemePreference() === "system") applyTheme("system");
    });
    return unwatch;
  }, []);
}

function AppRoutes() {
  useThemeSync();
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <PublicOnlyRoute>
            <LoginPage />
          </PublicOnlyRoute>
        }
      />
      <Route element={<ProtectedLayout />}>
        <Route path="/" element={<TodayPage />} />
        <Route path="/projects" element={<ProjectsPage />} />
        <Route path="/projects/:id" element={<ProjectDetailPage />} />
        <Route path="/timeline" element={<TimelinePage />} />
        <Route path="/context" element={<ContextPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/inbox" element={<InboxPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <CommandBarProvider>
          <AppRoutes />
          <CommandBar />
        </CommandBarProvider>
      </AuthProvider>
    </ToastProvider>
  );
}
