import {
  mkdtemp,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { backupDatabase } from "./backup-database";

type RunOptions = { cwd?: string; env?: NodeJS.ProcessEnv };
const mockRunFile = jest.fn<Promise<void>, [string, string[], RunOptions]>();

jest.mock("node:child_process", () => ({
  execFile: (
    file: string,
    args: string[],
    options: RunOptions,
    callback: (error: Error | null, stdout: string, stderr: string) => void,
  ) => {
    void mockRunFile(file, args, options).then(
      () => callback(null, "", ""),
      (error: Error) => callback(error, "", ""),
    );
  },
}));

describe("backupDatabase", () => {
  let directory: string;
  const connection =
    "postgresql://user:secret@localhost:5432/choir?schema=public&sslmode=require";

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), "chorhub-backup-test-"));
    mockRunFile.mockReset();
    mockRunFile.mockImplementation(async (file, args, options) => {
      if (file === "pg_dump") await writeFile(args[2], "SELECT 1;");
      if (file === "zip")
        await writeFile(join(options.cwd!, args[1]), "zip fixture");
    });
  });

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  it("creates a dated private archive and removes the raw SQL dump", async () => {
    const archive = await backupDatabase(connection, directory);
    expect(archive).toMatch(/chorhub-backup-\d{4}-\d{2}-\d{2}T.*\.sql\.zip$/);
    expect(await readFile(archive, "utf8")).toBe("zip fixture");
    expect((await stat(archive)).mode & 0o777).toBe(0o600);
    expect(await readdir(directory)).toEqual([
      archive.slice(directory.length + 1),
    ]);
    expect(mockRunFile.mock.calls[0][1]).not.toContain(connection);
    expect(mockRunFile.mock.calls[0][1][4]).toBe(
      "postgresql://user@localhost:5432/choir?sslmode=require",
    );
    expect(mockRunFile.mock.calls[0][2].env?.PGPASSWORD).toBe("secret");
  });

  it("uses distinct filenames for consecutive backups", async () => {
    const first = await backupDatabase(connection, directory);
    const second = await backupDatabase(connection, directory);
    expect(first).not.toBe(second);
    expect(await readdir(directory)).toHaveLength(2);
  });

  it("decodes URL passwords without placing them in process arguments", async () => {
    await backupDatabase(
      "postgresql://user:p%40ss%3Aword@localhost:5432/choir",
      directory,
    );
    expect(mockRunFile.mock.calls[0][2].env?.PGPASSWORD).toBe("p@ss:word");
    expect(mockRunFile.mock.calls[0][1][4]).toBe(
      "postgresql://user@localhost:5432/choir",
    );
  });

  it.each(["pg_dump", "zip"])(
    "cleans up after %s fails without disclosing credentials",
    async (failedTool) => {
      const writeFixture = mockRunFile.getMockImplementation()!;
      mockRunFile.mockImplementation(async (file, args, options) => {
        if (file === failedTool) throw new Error(connection);
        await writeFixture(file, args, options);
      });
      await expect(backupDatabase(connection, directory)).rejects.toThrow(
        `${failedTool} failed.`,
      );
      expect(await readdir(directory)).toEqual([]);
    },
  );

  it.each([undefined, "invalid", "https://example.org"])(
    "rejects invalid connection %s before running tools",
    async (url) => {
      await expect(backupDatabase(url, directory)).rejects.toThrow(
        "DATABASE_URL",
      );
      expect(mockRunFile).not.toHaveBeenCalled();
      expect(await readdir(directory)).toEqual([]);
    },
  );
});
