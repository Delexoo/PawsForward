/**
 * Local static server with Vercel-style clean URLs.
 * Usage: node scripts/dev-server.mjs
 * Then open http://127.0.0.1:5500/join
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const PORT = Number(process.env.PORT || 5500);
const HOST = process.env.HOST || "127.0.0.1";

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".webmanifest": "application/manifest+json",
  ".map": "application/json; charset=utf-8",
};

function safeJoin(root, reqPath) {
  const decoded = decodeURIComponent(reqPath.split("?")[0] || "/");
  const cleaned = path.normalize(decoded).replace(/^([/\\])+/, "");
  const full = path.resolve(root, cleaned);
  if (!full.startsWith(root)) return null;
  return full;
}

function candidates(urlPath) {
  const raw = decodeURIComponent(urlPath.split("?")[0] || "/");
  const noSlash = raw.replace(/\/+$/, "") || "/";
  const list = [];
  if (noSlash === "/") {
    list.push("index.html");
    return list;
  }
  const rel = noSlash.replace(/^\//, "");
  list.push(rel);
  if (!path.extname(rel)) {
    list.push(`${rel}.html`);
    list.push(path.join(rel, "index.html"));
  }
  return list;
}

function send(res, status, body, type) {
  res.writeHead(status, {
    "Content-Type": type || "text/plain; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(body);
}

const server = http.createServer((req, res) => {
  if (req.method !== "GET" && req.method !== "HEAD") {
    send(res, 405, "Method Not Allowed");
    return;
  }

  const urlPath = req.url || "/";
  for (const rel of candidates(urlPath)) {
    const full = safeJoin(ROOT, rel);
    if (!full) continue;
    let stat;
    try {
      stat = fs.statSync(full);
    } catch {
      continue;
    }
    if (!stat.isFile()) continue;
    const type = TYPES[path.extname(full).toLowerCase()] || "application/octet-stream";
    res.writeHead(200, {
      "Content-Type": type,
      "Cache-Control": "no-store",
      "Content-Length": stat.size,
    });
    if (req.method === "HEAD") {
      res.end();
      return;
    }
    fs.createReadStream(full).pipe(res);
    return;
  }

  const fallback = safeJoin(ROOT, "404.html");
  if (fallback && fs.existsSync(fallback)) {
    const body = fs.readFileSync(fallback);
    res.writeHead(404, {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "Content-Length": body.length,
    });
    res.end(req.method === "HEAD" ? undefined : body);
    return;
  }
  send(res, 404, "Not found");
});

server.listen(PORT, HOST, () => {
  console.log(`PawsForward local server → http://${HOST}:${PORT}`);
  console.log(`Try http://${HOST}:${PORT}/join`);
});
