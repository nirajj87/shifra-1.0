import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..");
const dist = path.join(root, "dist");
const live = path.join(root, "..", "live");

if (!fs.existsSync(path.join(dist, "index.html"))) {
  console.error("Build missing. Run: npm run build");
  process.exit(1);
}

fs.rmSync(live, { recursive: true, force: true });
fs.cpSync(dist, live, { recursive: true });
fs.writeFileSync(
  path.join(live, "UPLOAD.txt"),
  [
    "Shifra live build",
    "",
    "Upload EVERY file in this folder to your host under /shifra/",
    "Example live URL: https://your-domain.com/shifra/",
    "",
    "Apache/Nginx: this folder IS the /shifra/ document root.",
    "Do not upload the parent repo, only these files.",
    "",
  ].join("\n"),
  "utf8"
);

console.log(`Live folder ready: ${live}`);
