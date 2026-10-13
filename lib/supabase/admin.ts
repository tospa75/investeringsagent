import "server-only";

import { createClient } from "@supabase/supabase-js";
import { getServiceRoleEnvironment } from "@/lib/config/env";

/** Trusted backend jobs only. Never import this module from a Client Component. */
export function createAdminClient() {
  const environment = getServiceRoleEnvironment();
  if (!environment) throw new Error("Supabase secret-key environment is missing.");
  return createClient(environment.NEXT_PUBLIC_SUPABASE_URL, environment.SUPABASE_SECRET_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
