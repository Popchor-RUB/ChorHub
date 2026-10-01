import { execFile } from "node:child_process";
import { chmod, mkdir, mkdtemp, rename, rm } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { promisify } from "node:util";

const runFile = promisify(execFile);

export async function backupDatabase(
  databaseUrl: string | undefined,
  outputDirectory = "backups",
): Promise<string> {
  if (!databaseUrl) throw new Error("DATABASE_URL is required for backup.");
  let connection: URL;
  let password: string | undefined;
  try {
    connection = new URL(databaseUrl);
    if (!["postgres:", "postgresql:"].includes(connection.protocol)) {
      throw new Error("Invalid protocol");
    }
    password = connection.password
      ? decodeURIComponent(connection.password)
      : (connection.searchParams.get("password") ?? process.env.PGPASSWORD);
  } catch {
    throw new Error("DATABASE_URL must be a PostgreSQL connection URL.");
  }
  // Prisma's schema parameter is not a libpq connection option.
  connection.searchParams.delete("schema");
  connection.password = "";
  connection.searchParams.delete("password");

  const directory = resolve(outputDirectory);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const temporaryDirectory = await mkdtemp(join(directory, ".backup-"));
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `chorhub-backup-${timestamp}-${basename(temporaryDirectory).slice(8)}.sql`;
  const archiveName = `${filename}.zip`;
  const archivePath = join(directory, archiveName);

  try {
    try {
      await runFile(
        "pg_dump",
        [
          "--format=plain",
          "--file",
          join(temporaryDirectory, filename),
          "--dbname",
          connection.toString(),
        ],
        {
          // Keep the password out of process arguments and error messages.
          env: { ...process.env, PGPASSWORD: password },
        },
      );
    } catch {
      throw new Error(
        "pg_dump failed. Check PostgreSQL client installation, server version, and DATABASE_URL.",
      );
    }
    await chmod(join(temporaryDirectory, filename), 0o600);
    try {
      await runFile("zip", ["-q", archiveName, filename], {
        cwd: temporaryDirectory,
      });
    } catch {
      throw new Error(
        "zip failed. Check zip installation and available disk space.",
      );
    }
    await chmod(join(temporaryDirectory, archiveName), 0o600);
    await rename(join(temporaryDirectory, archiveName), archivePath);
    return archivePath;
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
}
