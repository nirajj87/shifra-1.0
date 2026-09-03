import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const src = path.join(dir, "ShifraLauncher.cs");
const outExe = path.join(dir, "Shifra.exe");
const repoExe = path.resolve(dir, "../../Shifra.exe");

const cscCandidates = [
  process.env.WINDIR &&
    path.join(process.env.WINDIR, "Microsoft.NET\\Framework64\\v4.0.30319\\csc.exe"),
  process.env.WINDIR &&
    path.join(process.env.WINDIR, "Microsoft.NET\\Framework\\v4.0.30319\\csc.exe"),
].filter(Boolean);

const csc = cscCandidates.find((file) => fs.existsSync(file));
if (!csc) {
  console.error("csc.exe nahi mila. Windows .NET Framework chahiye.");
  process.exit(1);
}

const refs = [
  "/r:System.dll",
  "/r:System.Windows.Forms.dll",
  "/r:System.Drawing.dll",
];

execFileSync(
  csc,
  ["/nologo", "/t:winexe", `/out:${outExe}`, ...refs, src],
  { stdio: "inherit" }
);

fs.copyFileSync(outExe, repoExe);
console.log(`Created ${outExe}`);
console.log(`Copied  ${repoExe}`);
