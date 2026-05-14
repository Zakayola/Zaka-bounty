/**
 * server.ts — Fastify Entry Point
 * ================================
 * Bootstraps the Zaka-Bounty backend API with CORS and Helmet security.
 */

import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import { bountiesRoutes } from "./routes/bounties";

const fastify = Fastify({
  logger: {
    transport: {
      target: "pino-pretty",
      options: {
        translateTime: "HH:MM:ss Z",
        ignore: "pid,hostname",
      },
    },
  },
});

async function buildServer() {
  // Security middlewares
  await fastify.register(helmet, { global: true });
  await fastify.register(cors, {
    origin: process.env.CORS_ORIGIN || "*",
    methods: ["GET", "POST", "PATCH", "OPTIONS"],
  });

  // Health check
  fastify.get("/ping", async () => {
    return { status: "ok", service: "zaka-bounty-indexer", time: new Date().toISOString() };
  });

  // API Routes
  await fastify.register(bountiesRoutes, { prefix: "/api" });

  return fastify;
}

async function start() {
  const PORT = parseInt(process.env.PORT || "4000", 10);
  try {
    const server = await buildServer();
    await server.listen({ port: PORT, host: "0.0.0.0" });
    server.log.info(`🚀 Zaka-Bounty Backend listening on port ${PORT}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

start();
