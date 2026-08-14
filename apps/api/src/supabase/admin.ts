import { loadSupabaseConfig } from "../config.js";
import { SupabaseHttpClient } from "./client.js";

// Server-only: this module must never be imported by apps/web or shared packages.
export function createSupabaseAdminClient() {
  const config = loadSupabaseConfig();
  return new SupabaseHttpClient(config, config.serviceRoleKey);
}
