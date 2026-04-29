import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { ThemeProvider, useTheme } from "next-themes";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import DashboardLayout from "./components/DashboardLayout";
import LandingPage from "./pages/LandingPage";
import AnalyzerPage from "./pages/AnalyzerPage";
import SearchScreeningPage from "./pages/SearchScreeningPage";
import ResultsDashboardPage from "./pages/ResultsDashboardPage";
import DocumentViewerPage from "./pages/DocumentViewerPage";
import AboutPage from "./pages/AboutPage";
import NotFound from "./pages/NotFound";
import { ClerkProvider, SignedIn, SignedOut, RedirectToSignIn, ClerkLoading, ClerkLoaded } from "@clerk/clerk-react";
import { dark } from "@clerk/themes";
import ApiAuthBinder from "./components/ApiAuthBinder";
import LoadingScreen from "./components/LoadingScreen";

const queryClient = new QueryClient();

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!PUBLISHABLE_KEY) {
  throw new Error("Missing Publishable Key. Please add VITE_CLERK_PUBLISHABLE_KEY to your .env.local file");
}

function ClerkWithTheme({ children }: { children: React.ReactNode }) {
  const { resolvedTheme } = useTheme();
  return (
    <ClerkProvider
      publishableKey={PUBLISHABLE_KEY}
      afterSignOutUrl="/"
      appearance={{
        baseTheme: resolvedTheme === "dark" ? dark : undefined,
        variables: {
          colorPrimary: "hsl(217, 91%, 60%)",
          borderRadius: "0.75rem",
        },
      }}
    >
      {children}
    </ClerkProvider>
  );
}

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
    <ClerkWithTheme>
      <ClerkLoading>
        <LoadingScreen label="Preparing secure session…" />
      </ClerkLoading>
      <ClerkLoaded>
      <ApiAuthBinder />
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route element={
                <>
                  <SignedIn>
                    <DashboardLayout />
                  </SignedIn>
                  <SignedOut>
                    <RedirectToSignIn />
                  </SignedOut>
                </>
              }>
                <Route path="/analyzer" element={<AnalyzerPage />} />
                <Route path="/search" element={<SearchScreeningPage />} />
                <Route path="/dashboard" element={<ResultsDashboardPage />} />
                <Route path="/viewer" element={<DocumentViewerPage />} />
                <Route path="/viewer/:analysisId" element={<DocumentViewerPage />} />
              </Route>
              <Route path="/about" element={<AboutPage />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
      </ClerkLoaded>
    </ClerkWithTheme>
  </ThemeProvider>
);

export default App;
