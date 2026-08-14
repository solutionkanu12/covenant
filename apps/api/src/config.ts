export type SupabaseConfig = {
  url: string;
  publishableKey: string;
  serviceRoleKey: string;
};

export function loadSupabaseConfig(
  env: NodeJS.ProcessEnv = process.env,
): SupabaseConfig {
  const url = env.SUPABASE_URL;
  const publishableKey = env.SUPABASE_PUBLISHABLE_KEY;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !publishableKey || !serviceRoleKey)
    throw new Error("Missing required Supabase server configuration");
  return { url: new URL(url).origin, publishableKey, serviceRoleKey };
}
