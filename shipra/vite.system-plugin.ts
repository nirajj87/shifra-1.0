import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin, PreviewServer, ViteDevServer } from "vite";
import { loadEnv } from "vite";

type SystemBody = {
  action?: string;
  name?: string;
  letter?: string;
};

function isLocal(req: IncomingMessage) {
  const ip = String(req.socket.remoteAddress || "");
  return ip === "127.0.0.1" || ip === "::1" || ip.endsWith("127.0.0.1");
}

function cleanPath(url = "") {
  return url.split("?")[0];
}

function isSystemRoute(url = "") {
  const clean = cleanPath(url);
  return clean === "/api/system" || clean === "/shifra/api/system";
}

function json(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function launch(command: string, args: string[], cwd?: string) {
  const child = spawn(command, args, {
    detached: true,
    stdio: "ignore",
    windowsHide: false,
    cwd,
    shell: false,
  });
  child.on("error", () => {
    /* missing exe should not crash the dev server */
  });
  child.unref();
}

function safeName(value: string) {
  const name = String(value || "").trim();
  if (!/^[A-Za-z0-9._-]+$/.test(name)) return "";
  return name;
}

function safeDrive(value: string) {
  const letter = String(value || "").trim().toUpperCase();
  if (!/^[A-Z]$/.test(letter)) return "";
  return letter;
}

function projectsRoot(env: Record<string, string>) {
  return env.SHIFRA_PROJECTS_DIR || "D:\\Projects";
}

function dockerExe(env: Record<string, string>) {
  return (
    env.SHIFRA_DOCKER_EXE ||
    "C:\\Program Files\\Docker\\Docker\\Docker Desktop.exe"
  );
}

function runAction(body: SystemBody, env: Record<string, string>) {
  const action = String(body.action || "").trim();

  if (action === "notepad") {
    launch("notepad.exe", []);
    return { ok: true };
  }

  if (action === "docker") {
    const exe = dockerExe(env);
    if (!fs.existsSync(exe)) {
      return { ok: false, error: "docker-missing" };
    }
    launch(exe, []);
    return { ok: true };
  }

  if (action === "open-drive") {
    const letter = safeDrive(body.letter || "D");
    if (!letter) return { ok: false, error: "bad-drive" };
    launch("explorer.exe", [`${letter}:\\`]);
    return { ok: true };
  }

  if (action === "open-project") {
    const name = safeName(body.name || "");
    if (!name) return { ok: false, error: "need-name" };
    const root = path.resolve(projectsRoot(env));
    const target = path.resolve(root, name);
    if (target !== root && !target.startsWith(`${root}${path.sep}`)) {
      return { ok: false, error: "bad-path" };
    }
    if (!fs.existsSync(target)) {
      return { ok: false, error: "missing-folder" };
    }
    launch("explorer.exe", [target]);
    return { ok: true };
  }

  if (action === "run-project") {
    const root = path.resolve(projectsRoot(env));
    const name = safeName(body.name || "shifra");
    const target = path.resolve(root, name);
    if (target !== root && !target.startsWith(`${root}${path.sep}`)) {
      return { ok: false, error: "bad-path" };
    }
    const pkg = path.join(target, "package.json");
    const nested = path.join(target, "shipra", "package.json");
    const cwd = fs.existsSync(nested)
      ? path.join(target, "shipra")
      : fs.existsSync(pkg)
        ? target
        : "";
    if (!cwd) return { ok: false, error: "missing-project" };
    const npm = process.platform === "win32" ? "npm.cmd" : "npm";
    launch(npm, ["run", "dev"], cwd);
    return { ok: true };
  }

  if (action === "email") {
    try {
      launch("outlook.exe", []);
    } catch {
      /* browser fallback on client */
    }
    return { ok: true, open: "https://mail.google.com" };
  }

  return { ok: false, error: "unknown-action" };
}

function attach(server: ViteDevServer | PreviewServer) {
  const env = loadEnv(server.config.mode, process.cwd(), "");

  server.middlewares.use((req, res, next) => {
    if (!isSystemRoute(req.url || "")) {
      next();
      return;
    }
    if (req.method !== "POST") {
      json(res, 405, { ok: false });
      return;
    }
    if (!isLocal(req)) {
      json(res, 403, { ok: false, error: "localhost-only" });
      return;
    }
    readBody(req)
      .then((raw) => {
        const body = JSON.parse(raw || "{}") as SystemBody;
        json(res, 200, runAction(body, env));
      })
      .catch(() => json(res, 400, { ok: false }));
  });
}

export function systemCommandsPlugin(): Plugin {
  return {
    name: "shifra-system-commands",
    configureServer: attach,
    configurePreviewServer: attach,
  };
}
