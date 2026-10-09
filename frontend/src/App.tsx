/**
 * Application root.
 *
 *   QueryClientProvider        server-state cache (api/*)
 *   └ BrowserRouter
 *     └ PreferencesProvider    mode / theme / sound (lib/preferences)
 *       └ ToastProvider        feedback messages (ui/Toast)
 *         └ SudoProvider       owner session, edit mode, shared editor (sudo/)
 *           ├ /sudo/login      LoginPage
 *           ├ /sudo/*          Dashboard (lazy)
 *           └ /*               PublicSite → active mode's views (lazy)
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Suspense, lazy } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";

import { ApiError } from "@/api/client";
import { BootScreen } from "@/app/BootScreen";
import { PublicSite } from "@/app/PublicSite";
import { PreferencesProvider } from "@/lib/preferences/PreferencesProvider";
import { isModeAvailable } from "@/modes/registry";
import { LoginPage } from "@/sudo/LoginPage";
import { SudoProvider } from "@/sudo/SudoProvider";
import { ToastProvider } from "@/ui/Toast";

const DashboardRoutes = lazy(() => import("@/sudo/dashboard/DashboardRoutes"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      // Client errors (404, 403 …) won't fix themselves; only retry network/5xx failures.
      retry: (count, error) => !(error instanceof ApiError && error.status < 500) && count < 2,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <PreferencesProvider isModeAvailable={isModeAvailable}>
          <ToastProvider>
            <SudoProvider>
              <Routes>
                <Route path="/sudo/login" element={<LoginPage />} />
                <Route
                  path="/sudo/*"
                  element={
                    <Suspense fallback={<BootScreen />}>
                      <DashboardRoutes />
                    </Suspense>
                  }
                />
                <Route path="/*" element={<PublicSite />} />
              </Routes>
            </SudoProvider>
          </ToastProvider>
        </PreferencesProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
