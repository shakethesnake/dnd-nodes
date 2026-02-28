/**
 * FlowForge Backend Server
 *
 * Express server for flow execution.
 * Run with: npx tsx src/examples/example4/server/index.ts
 */

import express from "express";
import cors from "cors";
import { createFlowRoutes } from "./routes/flowRoutes";
import { RunStore } from "./store/runStore";

// ── Configuration ────────────────────────────────────────────────────

const PORT = parseInt(process.env.FLOWFORGE_PORT ?? "3001", 10);
const CORS_ORIGIN = process.env.FLOWFORGE_CORS_ORIGIN ?? "http://localhost:5173";
const MAX_CONCURRENT_RUNS = parseInt(process.env.FLOWFORGE_MAX_RUNS ?? "5", 10);
const RUN_TTL_MS = parseInt(process.env.FLOWFORGE_RUN_TTL_MS ?? "300000", 10);

// ── Bootstrap ────────────────────────────────────────────────────────

const app = express();
const store = new RunStore({
  maxConcurrent: MAX_CONCURRENT_RUNS,
  ttlMs: RUN_TTL_MS,
});

// Middleware
app.use(cors({ origin: CORS_ORIGIN }));
app.use(express.json({ limit: "2mb" }));

// Routes
app.use("/api/flow", createFlowRoutes(store));

// Health check
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    activeRuns: store.activeCount,
    uptime: process.uptime(),
  });
});

// ── Start ────────────────────────────────────────────────────────────

const server = app.listen(PORT, () => {
  console.log(`FlowForge server running on http://localhost:${PORT}`);
  console.log(`  CORS origin: ${CORS_ORIGIN}`);
  console.log(`  Max concurrent runs: ${MAX_CONCURRENT_RUNS}`);
  console.log(`  Run TTL: ${RUN_TTL_MS / 1000}s`);
});

// Graceful shutdown
function shutdown() {
  console.log("\nShutting down...");
  store.dispose();
  server.close(() => {
    console.log("Server closed.");
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

export { app, store };
