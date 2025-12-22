import { useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";

import { supabase } from "@/lib/supabaseClient";
import Auth from "@/pages/Auth";
import DashboardLovable from "@/DashboardLovable";

function ProtectedRoute({
  session,
  children,
}: {
  session: Session | null;
  children: JSX.Element;
}) {
  if (!session) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session ?? null);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event: AuthChangeEvent, newSession: Session | null) => {
        setSession(newSession);
      }
    );

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  if (loading) return null;

  return (
    <Routes>
      {/* 🔐 LOGIN SEMPRE NA RAIZ */}
      <Route path="/" element={<Auth />} />

      {/* 🔒 DASHBOARD PROTEGIDA */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute session={session}>
            <DashboardLovable />
          </ProtectedRoute>
        }
      />

      {/* fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
