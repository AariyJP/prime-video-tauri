import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync, writeFileSync } from "node:fs";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const version = process.argv[2] ?? process.env.APP_VERSION;

if (!version) {
  throw new Error("Version argument or APP_VERSION is required.");
}

if (!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(version)) {
  throw new Error(`Invalid app version: ${version}`);
}

function projectPath(path) {
  return join(repoRoot, path);
}

function updateJson(path) {
  const fullPath = projectPath(path);
  const data = JSON.parse(readFileSync(fullPath, "utf8"));
  data.version = version;
  writeFileSync(fullPath, `${JSON.stringify(data, null, 2)}\n`);
}

function updatePrimeVideoTomlVersion(path) {
  const fullPath = projectPath(path);
  const text = readFileSync(fullPath, "utf8");
  const next = text.replace(
    /(\[\[?package\]?\]\s*name\s*=\s*"prime-video-tauri"\s*version\s*=\s*")[^"]+(")/m,
    (_, prefix, suffix) => `${prefix}${version}${suffix}`,
  );

  if (next === text) {
    throw new Error(`prime-video-tauri version was not found in ${path}`);
  }

  writeFileSync(fullPath, next);
}

updateJson("package.json");
updateJson("src-tauri/tauri.conf.json");
updatePrimeVideoTomlVersion("src-tauri/Cargo.toml");
updatePrimeVideoTomlVersion("src-tauri/Cargo.lock");

console.log(`Set Prime Video Tauri version to ${version}`);
