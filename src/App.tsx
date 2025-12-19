import { useEffect, useState } from "react";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";
import Auth from "@/pages/Auth";
import DashboardLovable from "@/DashboardLovable";

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session ?? null);
      setLoading(false);
    });

   const { data: listener } = supabase.auth.onAuthStateChange(
    (event: AuthChangeEvent, newSession: Session | null) => {
      console.log("AUTH EVENT:", event);
      console.log("APP onAuthStateChange session:", newSession);

      setSession(newSession);
    }
    );

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  if (loading) return null;

  if (!session) return <Auth />;

  return <DashboardLovable />;
}
