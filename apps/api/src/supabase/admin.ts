import { loadSupabaseConfig, type SupabaseConfig } from "../config.js";
import { SupabaseHttpClient } from "./client.js";

// Server-only: this module must never be imported by apps/web or shared packages.
export function createSupabaseAdminClient(
  config: SupabaseConfig = loadSupabaseConfig(),
) {
  return new SupabaseHttpClient(config, config.serviceRoleKey);
}
