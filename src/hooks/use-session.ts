import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

/** `undefined` enquanto a sessão ainda está sendo verificada, `null` quando não há login. */
export function useSession() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    supabase.auth.getSession().then(({ data: { session: current } }) => setSession(current));
    return () => data.subscription.unsubscribe();
  }, []);

  return session;
}
