import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { realpathSync } from "node:fs";
import { join } from "node:path";

/** @param {string[]} args */
function runTmux(args) {
  const result = spawnSync("tmux", args, { encoding: "utf8" });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(
      result.stderr.trim() || `tmux exited with code ${result.status}.`,
    );
  }
  return result.stdout.trim();
}

/** @param {string} value */
function shellQuote(value) {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

/**
 * Start detached servers, or return null when tmux is not installed.
 * Each checkout has its own session; existing live windows are left running.
 * @param {string} directory
 * @param {string[]} npmCommand
 * @returns {string | null}
 */
export function startTmuxDevServers(directory, npmCommand) {
  const available = spawnSync("tmux", ["-V"], { encoding: "utf8" });
  if (available.error?.code === "ENOENT") return null;
  if (available.error) throw available.error;
  if (available.status !== 0) {
    throw new Error(available.stderr.trim() || "Unable to run tmux.");
  }

  const root = realpathSync(directory);
  const hash = createHash("sha256").update(root).digest("hex").slice(0, 12);
  const session = `chorhub-dev-${hash}`;
  const target = `=${session}`;
  const existing = spawnSync("tmux", ["has-session", "-t", target]);
  if (existing.error) throw existing.error;
  if (existing.status !== 0 && existing.status !== 1) {
    throw new Error("Unable to check the development tmux session.");
  }
  let sessionExists = existing.status === 0;

  for (const [name, script] of [
    ["frontend", "dev"],
    ["backend", "start:dev"],
  ]) {
    const command = `exec ${[...npmCommand, "--prefix", join(root, name), "run", script].map(shellQuote).join(" ")}`;
    const windows = sessionExists
      ? runTmux([
          "list-windows",
          "-t",
          target,
          "-F",
          "#{window_id}\t#{window_name}\t#{pane_dead}",
        ])
          .split("\n")
          .map((line) => line.split("\t"))
      : [];
    const window = windows.find(([, windowName]) => windowName === name);
    let windowId;

    if (window) {
      windowId = window[0];
      if (window[2] === "1") {
        runTmux(["respawn-window", "-t", windowId, "-c", root, command]);
      }
    } else {
      windowId = runTmux(
        sessionExists
          ? [
              "new-window",
              "-d",
              "-P",
              "-F",
              "#{window_id}",
              "-t",
              `${target}:`,
              "-n",
              name,
              "-c",
              root,
              command,
            ]
          : [
              "new-session",
              "-d",
              "-P",
              "-F",
              "#{window_id}",
              "-s",
              session,
              "-n",
              name,
              "-c",
              root,
              command,
            ],
      );
      sessionExists = true;
    }
    runTmux(["set-option", "-w", "-t", windowId, "automatic-rename", "off"]);
    runTmux(["set-option", "-w", "-t", windowId, "allow-rename", "off"]);
  }

  return session;
}
