import type { FastifyReply, FastifyRequest } from "fastify";
import type { BackendRepository } from "../backend/repository.js";

export function requireAdmin(repository?: BackendRepository) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.authUser)
      return reply.code(401).send({ error: "Authentication required" });
    if (!repository)
      return reply.code(503).send({ error: "Backend services unavailable" });
    if (!(await repository.isAdmin(request.authUser.id)))
      return reply.code(403).send({ error: "Administrator access required" });
  };
}
