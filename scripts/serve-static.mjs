import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
const root = resolve("apps/web/out");
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".txt": "text/plain",
};
http
  .createServer(async (req, res) => {
    try {
      const pathname = decodeURIComponent(
        new URL(req.url, "http://localhost").pathname,
      );
      let path = resolve(root, "." + pathname);
      if (path !== root && !path.startsWith(root + sep)) {
        res.writeHead(403);
        res.end();
        return;
      }
      const info = await stat(path);
      if (info.isDirectory()) path = resolve(path, "index.html");
      const content = await readFile(path);
      res.writeHead(200, {
        "content-type": types[extname(path)] || "application/octet-stream",
      });
      res.end(content);
    } catch {
      res.writeHead(404, { "content-type": "text/plain" });
      res.end("Not found");
    }
  })
  .listen(Number(process.env.PORT || 3000), "127.0.0.1", () =>
    console.log(
      `CausEval production preview: http://127.0.0.1:${process.env.PORT || 3000}`,
    ),
  );
