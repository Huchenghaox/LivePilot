import { spawn } from "node:child_process";
import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import { join } from "node:path";

const cwd = process.cwd();
const devVarsPath = join(cwd, ".dev.vars");
const backupPath = join(cwd, `.dev.vars.backup-${Date.now()}`);
const hadDevVars = existsSync(devVarsPath);

if (hadDevVars) renameSync(devVarsPath, backupPath);

writeFileSync(
  devVarsPath,
  [
    "APP_ENV=development",
    "JWT_SECRET=local-worker-secret-local-worker-secret",
    "MODEL_ENCRYPTION_KEY=local-model-encryption-key-32chars",
    "REGISTRATION_MODE=invite",
    "SMS_ENABLED=true",
    "SMS_PROVIDER=mock",
    "MODEL_PROVIDER=mock",
    "INITIAL_ADMIN_USERNAME=livepilotadmin",
    ""
  ].join("\n"),
  { mode: 0o600 }
);

const worker = spawn("npx", ["wrangler", "dev", "--local", "--port", "8787"], {
  cwd,
  stdio: ["ignore", "pipe", "pipe"],
  env: { ...process.env, NO_COLOR: "1" }
});

let output = "";
worker.stdout.on("data", (chunk) => {
  output += chunk.toString();
});
worker.stderr.on("data", (chunk) => {
  output += chunk.toString();
});

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForWorker() {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch("http://127.0.0.1:8787/api/health");
      if (response.ok) return;
    } catch {
      // Wait until Wrangler is ready.
    }
    await delay(500);
  }
  throw new Error(`Worker did not start in time.\n${output.slice(-4000)}`);
}

async function cleanup() {
  worker.kill("SIGTERM");
  await delay(500);
  await rm(devVarsPath, { force: true });
  if (hadDevVars) renameSync(backupPath, devVarsPath);
}

try {
  await waitForWorker();
  await new Promise((resolve, reject) => {
    const smoke = spawn("node", ["scripts/smoke-worker.mjs"], {
      cwd,
      stdio: "inherit",
      env: { ...process.env, WORKER_BASE_URL: "http://127.0.0.1:8787" }
    });
    smoke.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Worker smoke failed with exit code ${code}`));
    });
    smoke.on("error", reject);
  });
} finally {
  await cleanup();
}
