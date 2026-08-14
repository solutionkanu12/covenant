import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "../app.js";
import type { SupabaseHttpClient } from "../supabase/client.js";

function client() {
  return {
    getUser: async (token: string) => {
      if (token !== "valid") throw new Error();
      return { id: "user-1" };
    },
    from: () => ({
      select: async () => [
        { id: "user-1", display_name: null, wallet_address: null },
      ],
      insert: async () => [],
      update: async () => [],
    }),
    signUp: async () => ({}),
    signIn: async () => ({}),
  } as unknown as SupabaseHttpClient;
}
test("profile endpoint rejects missing and invalid bearer tokens", async () => {
  const app = buildApp({ supabase: client(), admin: client() });
  assert.equal(
    (await app.inject({ method: "GET", url: "/api/profile" })).statusCode,
    401,
  );
  assert.equal(
    (
      await app.inject({
        method: "GET",
        url: "/api/profile",
        headers: { authorization: "Bearer wrong" },
      })
    ).statusCode,
    401,
  );
  assert.equal(
    (
      await app.inject({
        method: "GET",
        url: "/api/profile",
        headers: { authorization: "Bearer valid" },
      })
    ).statusCode,
    200,
  );
  await app.close();
});
