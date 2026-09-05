import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const temporaryOutput = mkdtempSync(join(tmpdir(), "ove-release-"));
const builder = join(appRoot, "node_modules", "electron-builder", "out", "cli", "cli.js");

try {
  execFileSync(process.execPath, [builder, "--linux", "AppImage", "--publish", "never", `--config.directories.output=${temporaryOutput}`], {
    cwd: appRoot,
    stdio: "inherit",
  });
  const artifact = readdirSync(temporaryOutput).find((name) => name.endsWith(".AppImage"));
  if (!artifact) throw new Error("electron-builder did not produce an AppImage");
  const releaseDirectory = join(appRoot, "release");
  mkdirSync(releaseDirectory, { recursive: true });
  copyFileSync(join(temporaryOutput, artifact), join(releaseDirectory, artifact));
  console.log(`Desktop artifact copied to release/${artifact}`);
} finally {
  rmSync(temporaryOutput, { recursive: true, force: true });
}
