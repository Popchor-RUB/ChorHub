import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  mkdtempSync,
  mkdirSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { startTmuxDevServers } from "./dev-tmux.mjs";

const tmuxPath = spawnSync("which", ["tmux"], {
  encoding: "utf8",
}).stdout?.trim();

test(
  "tmux servers reuse live windows and recover missing or exited windows",
  {
    skip: !tmuxPath,
  },
  async () => {
    const temporary = mkdtempSync(join(tmpdir(), "chorhub-tmux-"));
    const socket = join(temporary, "socket");
    const directory = join(temporary, "checkout with ' quotes");
    const binaryDirectory = join(temporary, "bin");
    const originalPath = process.env.PATH;
    mkdirSync(directory);
    mkdirSync(binaryDirectory);
    const quote = (value) => `'${value.replaceAll("'", "'\\''")}'`;
    writeFileSync(
      join(binaryDirectory, "tmux"),
      `#!/bin/sh\nexec ${quote(tmuxPath)} -S ${quote(socket)} -f /dev/null "$@"\n`,
      { mode: 0o755 },
    );
    const npm = join(binaryDirectory, "fake-npm");
    writeFileSync(
      npm,
      '#!/bin/sh\nprintf "%s\\n" "$@"\nexec /bin/sleep 120\n',
      { mode: 0o755 },
    );
    process.env.PATH = `${binaryDirectory}:${originalPath}`;

    const tmux = (...args) => {
      const result = spawnSync(tmuxPath, ["-S", socket, ...args], {
        encoding: "utf8",
      });
      assert.equal(result.status, 0, result.stderr);
      return result.stdout.trim();
    };
    const windows = (session) =>
      tmux("list-windows", "-t", session, "-F", "#{window_name}\t#{pane_pid}")
        .split("\n")
        .map((line) => line.split("\t"));

    try {
      const session = startTmuxDevServers(directory, [npm]);
      assert.ok(session);
      const first = windows(session);
      assert.deepEqual(first.map(([name]) => name).sort(), [
        "backend",
        "frontend",
      ]);
      assert.equal(startTmuxDevServers(directory, [npm]), session);
      assert.deepEqual(
        windows(session),
        first,
        "Repeated starts must not duplicate running servers",
      );
      await new Promise((resolve) => setTimeout(resolve, 100));
      for (const [name, script] of [
        ["frontend", "dev"],
        ["backend", "start:dev"],
      ]) {
        const output = tmux(
          "capture-pane",
          "-p",
          "-J",
          "-t",
          `${session}:${name}`,
        );
        assert.ok(output.includes(join(realpathSync(directory), name)), output);
        assert.ok(output.includes(script), output);
      }

      tmux("kill-window", "-t", `${session}:backend`);
      startTmuxDevServers(directory, [npm]);
      assert.equal(windows(session).length, 2);
      assert.equal(
        windows(session).find(([name]) => name === "frontend")[1],
        first[0][1],
      );

      tmux(
        "set-option",
        "-w",
        "-t",
        `${session}:backend`,
        "remain-on-exit",
        "on",
      );
      const pid = windows(session).find(([name]) => name === "backend")[1];
      process.kill(Number(pid), "SIGTERM");
      for (let attempts = 0; attempts < 50; attempts++) {
        if (
          tmux(
            "display-message",
            "-p",
            "-t",
            `${session}:backend`,
            "#{pane_dead}",
          ) === "1"
        )
          break;
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      assert.equal(
        tmux(
          "display-message",
          "-p",
          "-t",
          `${session}:backend`,
          "#{pane_dead}",
        ),
        "1",
      );
      startTmuxDevServers(directory, [npm]);
      assert.notEqual(
        windows(session).find(([name]) => name === "backend")[1],
        pid,
      );

      const otherDirectory = join(temporary, "other-checkout");
      mkdirSync(otherDirectory);
      assert.notEqual(startTmuxDevServers(otherDirectory, [npm]), session);
    } finally {
      spawnSync(tmuxPath, ["-S", socket, "kill-server"]);
      process.env.PATH = originalPath;
      rmSync(temporary, { recursive: true, force: true });
    }
  },
);

test("missing tmux selects the foreground fallback", () => {
  const originalPath = process.env.PATH;
  process.env.PATH = "/nonexistent-chorhub-test-directory";
  try {
    assert.equal(startTmuxDevServers(process.cwd(), ["npm"]), null);
  } finally {
    process.env.PATH = originalPath;
  }
});
