"use client";

import { createBrowserClient } from "@supabase/ssr";
import { getPublicEnvironment } from "@/lib/config/env";

export function createClient() {
  const environment = getPublicEnvironment();
  if (!environment) throw new Error("Supabase public environment variables are missing or invalid.");
  return createBrowserClient(environment.NEXT_PUBLIC_SUPABASE_URL, environment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
}
