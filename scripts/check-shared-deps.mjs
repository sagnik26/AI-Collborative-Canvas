import fs from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(process.cwd());

const color = {
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
};

function readJson(absPath) {
  return JSON.parse(fs.readFileSync(absPath, "utf8"));
}

function listWorkspacePackageJsonPaths() {
  const packagesDir = path.join(repoRoot, "packages");
  if (!fs.existsSync(packagesDir)) return [];

  return fs
    .readdirSync(packagesDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => path.join(packagesDir, d.name, "package.json"))
    .filter((p) => fs.existsSync(p));
}

function getDeps(pkgJson, includeDev) {
  return {
    ...(pkgJson.dependencies ?? {}),
    ...(pkgJson.optionalDependencies ?? {}),
    ...(pkgJson.peerDependencies ?? {}),
    ...(includeDev ? pkgJson.devDependencies ?? {} : {}),
  };
}

function parseCommaList(s) {
  if (!s) return new Set();
  return new Set(
    s
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean),
  );
}

const includeDev = process.env.CHECK_DEPS_INCLUDE_DEV === "1";
const ignoreDeps = parseCommaList(process.env.CHECK_DEPS_IGNORE);

const pkgJsonPaths = listWorkspacePackageJsonPaths();
const pkgs = pkgJsonPaths.map((p) => {
  const json = readJson(p);
  return {
    name:
      typeof json.name === "string"
        ? json.name
        : path.basename(path.dirname(p)),
    path: path.relative(repoRoot, p),
    deps: getDeps(json, includeDev),
  };
});

/** @type {Map<string, Array<{pkg: string, version: string}>>} */
const usage = new Map();
for (const pkg of pkgs) {
  for (const [dep, version] of Object.entries(pkg.deps)) {
    if (ignoreDeps.has(dep)) continue;
    if (typeof version !== "string") continue;
    const arr = usage.get(dep) ?? [];
    arr.push({ pkg: pkg.name, version });
    usage.set(dep, arr);
  }
}

let ok = true;
let anyMismatch = false;
for (const [dep, usages] of usage.entries()) {
  if (usages.length < 2) continue; // only enforce alignment when shared

  const uniq = new Set(usages.map((u) => u.version));
  if (uniq.size !== 1) {
    ok = false;
    anyMismatch = true;
    // eslint-disable-next-line no-console
    console.error(color.red(`✗ [deps] Version mismatch for shared "${dep}":`));
    for (const u of usages.sort((a, b) => a.pkg.localeCompare(b.pkg))) {
      // eslint-disable-next-line no-console
      console.error(`  - ${u.pkg}: ${u.version}`);
    }
  }
}

if (!ok) {
  if (!anyMismatch) {
    // eslint-disable-next-line no-console
    console.error(color.red("✗ [deps] Shared dependency check failed."));
  }
  // eslint-disable-next-line no-console
  console.error(color.dim(`[deps] includeDev=${includeDev}`));
  process.exit(1);
}

// eslint-disable-next-line no-console
console.log(color.green(`✓ [deps] All shared dependency versions are aligned.`));
// eslint-disable-next-line no-console
console.log(color.dim(`[deps] includeDev=${includeDev}`));

