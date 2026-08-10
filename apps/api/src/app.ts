import Fastify from "fastify";

import { productName } from "@covenant/shared";

export function buildApp() {
  const app = Fastify({ logger: true });

  app.get("/health", async () => ({
    service: productName,
    status: "ok",
  }));

  return app;
}
