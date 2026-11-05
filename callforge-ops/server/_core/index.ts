import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Automatically locate and load the unified .env file regardless of current working directory
const candidateEnvFiles = [
  path.resolve(__dirname, "../../.env"),
  path.resolve(__dirname, "../../../.env"),
  path.resolve(process.cwd(), ".env"),
];
for (const envPath of candidateEnvFiles) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
  }
}

if (!process.env.NODE_ENV) {
  if (fs.existsSync(path.resolve(__dirname, "public/index.html")) || fs.existsSync(path.resolve(__dirname, "../dist/public/index.html"))) {
    process.env.NODE_ENV = "production";
  } else {
    process.env.NODE_ENV = "development";
  }
}
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { callingRouter } from "../calling/routes";
import { dialerWorker } from "../calling/queue";
import { realtimeVoiceEngine } from "../calling/realtimeVoiceStream";

import { spawn, ChildProcess } from "child_process";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, "0.0.0.0", () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

let coreEngineProcess: ChildProcess | null = null;

async function ensureCoreEngineRunning() {
  try {
    const isPort8000Up = !(await isPortAvailable(8000));
    if (isPort8000Up) {
      console.log("[Core Engine] Python voice agent engine active (Internal Port 8000).");
      return;
    }

    const candidateDirs = [
      path.resolve(process.cwd(), "../core-engine"),
      path.resolve(process.cwd(), "core-engine"),
      path.resolve(__dirname, "../../../core-engine"),
      path.resolve(__dirname, "../../core-engine"),
    ];
    const coreDir = candidateDirs.find((d) => fs.existsSync(d) && fs.existsSync(path.join(d, "server.py")));
    if (coreDir) {
      console.log(`[Core Engine] Starting internal voice engine as unified background service from ${coreDir}...`);
      coreEngineProcess = spawn("python", ["server.py"], {
        cwd: coreDir,
        stdio: "ignore",
        windowsHide: true,
      });

      coreEngineProcess.on("error", (err) => {
        console.warn("[Core Engine] Internal engine notice:", err.message);
      });
    }
  } catch (err: any) {
    console.warn("[Core Engine] Internal engine notice:", err.message);
  }
}

// Clean shutdown hook
const cleanupCoreEngine = () => {
  if (coreEngineProcess && !coreEngineProcess.killed) {
    try {
      coreEngineProcess.kill();
    } catch {}
  }
};
process.on("exit", cleanupCoreEngine);
process.on("SIGINT", () => {
  cleanupCoreEngine();
  process.exit();
});
process.on("SIGTERM", () => {
  cleanupCoreEngine();
  process.exit();
});

async function startServer() {
  const app = express();
  const server = createServer(app);
  realtimeVoiceEngine.attach(server);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  registerStorageProxy(app);
  // Fast interceptor for Manus logs/debug to prevent serving heavy HTML and connection drops
  app.all("/__manus__/*", (_req, res) => {
    res.status(200).json({ success: true });
  });

  // High-throughput calling and dialer API
  app.use("/api/calling", callingRouter);
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  const isDist = fs.existsSync(path.resolve(__dirname, "public/index.html"));
  if (isDist || process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    await setupVite(app, server);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.warn(`\n[PORT NOTICE] Port ${preferredPort} is busy, server started on port ${port}.`);
    console.warn(`[PORT TIP] In GitHub Codespaces, to keep port 3000 consistent, run: pkill -f "node|tsx|vite"\n`);
  }

  await ensureCoreEngineRunning();

  server.listen(port, "0.0.0.0", () => {
    console.log(`\n=============================================================`);
    console.log(`CallForge Smart AI Calling Platform — Unified System`);
    console.log(`  > Dashboard Console: http://localhost:${port}/`);
    console.log(`=============================================================\n`);
    dialerWorker.start();
  });
}

startServer().catch(console.error);
