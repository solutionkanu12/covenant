import type { FastifyReply, FastifyRequest } from "fastify";
import type { AuthUser, SupabaseHttpClient } from "../supabase/client.js";

declare module "fastify" {
  interface FastifyRequest {
    authUser?: AuthUser;
    accessToken?: string;
  }
}
export function requireAuthentication(client: SupabaseHttpClient) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const header = request.headers.authorization;
    if (!header?.startsWith("Bearer "))
      return reply.code(401).send({ error: "Authentication required" });
    try {
      request.accessToken = header.slice(7);
      request.authUser = await client.getUser(request.accessToken);
    } catch {
      return reply.code(401).send({ error: "Invalid or expired access token" });
    }
  };
}
