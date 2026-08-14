import type { SupabaseConfig } from "../config.js";

type ApiError = { message?: string };
export type AuthUser = { id: string; email?: string };

export class SupabaseHttpClient {
  constructor(
    private readonly config: SupabaseConfig,
    private readonly key: string,
  ) {}

  private async request<T>(
    path: string,
    init: RequestInit = {},
    accessToken?: string,
  ): Promise<T> {
    const response = await fetch(`${this.config.url}${path}`, {
      ...init,
      headers: {
        apikey: this.key,
        Authorization: `Bearer ${accessToken ?? this.key}`,
        "Content-Type": "application/json",
        ...init.headers,
      },
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as ApiError;
      throw new Error(
        body.message ?? `Supabase request failed (${response.status})`,
      );
    }
    return response.status === 204
      ? (undefined as T)
      : ((await response.json()) as T);
  }

  signUp(email: string, password: string) {
    return this.request<{ user: AuthUser; access_token?: string }>(
      "/auth/v1/signup",
      { method: "POST", body: JSON.stringify({ email, password }) },
    );
  }
  signIn(email: string, password: string) {
    return this.request<{ user: AuthUser; access_token: string }>(
      "/auth/v1/token?grant_type=password",
      { method: "POST", body: JSON.stringify({ email, password }) },
    );
  }
  getUser(token: string) {
    return this.request<AuthUser>("/auth/v1/user", {}, token);
  }
  health() {
    return this.request<unknown[]>("/rest/v1/commitments?select=id&limit=1");
  }
  from<T>(table: string, token?: string) {
    return {
      select: (query = "*", filter = "") =>
        this.request<T[]>(
          `/rest/v1/${table}?select=${encodeURIComponent(query)}${filter ? `&${filter}` : ""}`,
          {},
          token,
        ),
      insert: (body: unknown) =>
        this.request<T[]>(
          `/rest/v1/${table}`,
          {
            method: "POST",
            headers: { Prefer: "return=representation" },
            body: JSON.stringify(body),
          },
          token,
        ),
      upsert: (body: unknown, onConflict: string) =>
        this.request<T[]>(
          `/rest/v1/${table}?on_conflict=${encodeURIComponent(onConflict)}`,
          {
            method: "POST",
            headers: {
              Prefer: "resolution=merge-duplicates,return=representation",
            },
            body: JSON.stringify(body),
          },
          token,
        ),
      update: (filter: string, body: unknown) =>
        this.request<T[]>(
          `/rest/v1/${table}?${filter}`,
          {
            method: "PATCH",
            headers: { Prefer: "return=representation" },
            body: JSON.stringify(body),
          },
          token,
        ),
    };
  }
}

export function createUserSupabaseClient(config: SupabaseConfig) {
  return new SupabaseHttpClient(config, config.publishableKey);
}
