import { useState, useEffect } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, useLocation } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import { LoginPage } from "./pages/LoginPage";

function Router() {
  const [, setLocation] = useLocation();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    try {
      const user = localStorage.getItem("creatorai_auth_user");
      return !!user;
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const checkAuth = () => {
      try {
        const user = localStorage.getItem("creatorai_auth_user");
        setIsAuthenticated(!!user);
      } catch {
        setIsAuthenticated(false);
      }
    };

    window.addEventListener("storage", checkAuth);
    return () => window.removeEventListener("storage", checkAuth);
  }, []);

  const handleLoginSuccess = () => {
    setIsAuthenticated(true);
    setLocation("/");
  };

  return (
    <Switch>
      <Route path="/login">
        {() => <LoginPage onLoginSuccess={handleLoginSuccess} />}
      </Route>
      <Route path="/">
        {() => {
          if (!isAuthenticated) {
            return <LoginPage onLoginSuccess={handleLoginSuccess} />;
          }
          return <Home />;
        }}
      </Route>
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster theme="dark" />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
