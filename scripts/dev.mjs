import { spawn, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { connect } from "node:net";

const DATABASE_WAIT_TIMEOUT_MS = 30_000;
const DATABASE_RETRY_INTERVAL_MS = 500;
const CONNECTION_TIMEOUT_MS = 1_000;
const COMPOSE_FILE = "docker-compose.dev.yaml";
const NPM_COMMAND = process.platform === "win32" ? "npm.cmd" : "npm";

/** @typedef {{ host: string, port: number }} DatabaseEndpoint */

/** @returns {string} */
function readDatabaseUrl() {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }

  try {
    const envFile = readFileSync("backend/.env", "utf8");
    const match = envFile.match(/^DATABASE_URL\s*=\s*(.+)$/m);

    if (match) {
      return match[1].trim().replace(/^(["'])(.*)\1$/, "$2");
    }
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
  }

  return "postgresql://localhost:5432/chorhub";
}

/** @returns {DatabaseEndpoint} */
function getDatabaseEndpoint() {
  const databaseUrl = new URL(readDatabaseUrl());

  return {
    host: databaseUrl.hostname,
    port: Number(databaseUrl.port || 5432),
  };
}

/**
 * @param {DatabaseEndpoint} endpoint
 * @returns {Promise<boolean>}
 */
function canConnect({ host, port }) {
  return new Promise((resolve) => {
    const socket = connect({ host, port });

    /** @param {boolean} available */
    const finish = (available) => {
      socket.destroy();
      resolve(available);
    };

    socket.setTimeout(CONNECTION_TIMEOUT_MS);
    socket.once("connect", () => finish(true));
    socket.once("error", () => finish(false));
    socket.once("timeout", () => finish(false));
  });
}

/** @returns {void} */
function startDevelopmentStack() {
  console.log("Database unavailable. Starting development Docker stack...");

  const result = spawnSync(
    "docker",
    ["compose", "-f", COMPOSE_FILE, "up", "-d"],
    { stdio: "inherit" },
  );

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`Docker Compose exited with code ${result.status}.`);
  }
}

/** @param {DatabaseEndpoint} endpoint */
async function waitForDatabase(endpoint) {
  const deadline = Date.now() + DATABASE_WAIT_TIMEOUT_MS;

  while (Date.now() < deadline) {
    if (await canConnect(endpoint)) {
      return;
    }

    await new Promise((resolve) =>
      setTimeout(resolve, DATABASE_RETRY_INTERVAL_MS),
    );
  }

  throw new Error(
    `Database did not become available at ${endpoint.host}:${endpoint.port}.`,
  );
}

/**
 * @param {string} name
 * @param {string} directory
 * @param {string} script
 * @returns {import("node:child_process").ChildProcess}
 */
function startDevServer(name, directory, script) {
  const child = spawn(NPM_COMMAND, ["--prefix", directory, "run", script], {
    detached: process.platform !== "win32",
    stdio: "inherit",
  });

  child.on("error", (error) => {
    console.error(`${name} failed to start:`, error);
  });

  return child;
}

/**
 * @param {import("node:child_process").ChildProcess} child
 * @param {NodeJS.Signals} signal
 */
function stopProcess(child, signal) {
  if (!child.pid || child.exitCode !== null) {
    return;
  }

  try {
    if (process.platform === "win32") {
      child.kill(signal);
    } else {
      process.kill(-child.pid, signal);
    }
  } catch (error) {
    if (error.code !== "ESRCH") {
      throw error;
    }
  }
}

/** @returns {void} */
function runDevServers() {
  const children = [
    {
      name: "Backend",
      process: startDevServer("Backend", "backend", "start:dev"),
    },
    {
      name: "Frontend",
      process: startDevServer("Frontend", "frontend", "dev"),
    },
  ];
  let stopping = false;

  /**
   * @param {number} exitCode
   * @param {NodeJS.Signals} signal
   */
  const shutdown = (exitCode, signal = "SIGTERM") => {
    if (stopping) {
      return;
    }

    stopping = true;
    process.exitCode = exitCode;
    children.forEach(({ process: child }) => stopProcess(child, signal));

    setTimeout(() => process.exit(exitCode), 5_000).unref();
  };

  children.forEach(({ name, process: child }) => {
    child.on("error", () => shutdown(1));
    child.on("exit", (code, signal) => {
      if (!stopping) {
        console.error(
          `${name} stopped${signal ? ` from ${signal}` : ` with code ${code}`}.`,
        );
        shutdown(code ?? 1);
      }

      if (
        children.every(
          ({ process }) =>
            process.exitCode !== null || process.signalCode !== null,
        )
      ) {
        process.exit(process.exitCode ?? 0);
      }
    });
  });

  process.once("SIGINT", () => shutdown(130, "SIGINT"));
  process.once("SIGTERM", () => shutdown(143));
}

/** @returns {Promise<void>} */
async function main() {
  const endpoint = getDatabaseEndpoint();

  if (!(await canConnect(endpoint))) {
    startDevelopmentStack();
    await waitForDatabase(endpoint);
  }

  console.log(`Database available at ${endpoint.host}:${endpoint.port}.`);
  runDevServers();
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
