"use client";

import { createBrowserClient } from "@supabase/ssr";
import { assertSupabaseEnv, supabaseAnonKey, supabaseUrl } from "./env";

export function createClient() {
  assertSupabaseEnv();
  return createBrowserClient(supabaseUrl!, supabaseAnonKey!);
}
