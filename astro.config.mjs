// @ts-check
import { execSync } from "node:child_process";
import { defineConfig } from "astro/config";

let commitHash = "dev";
try {
  commitHash = execSync("git rev-parse --short HEAD").toString().trim() || "dev";
} catch {}

const buildDate = new Date().toISOString().slice(0, 10);

// https://astro.build/config
export default defineConfig({
  site: "https://5n7.me",
  output: "static",
  vite: {
    define: {
      __BUILD_DATE__: JSON.stringify(buildDate),
      __COMMIT_HASH__: JSON.stringify(commitHash),
    },
  },
});
