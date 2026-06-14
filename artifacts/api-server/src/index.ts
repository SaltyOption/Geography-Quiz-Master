import app, { devViteProxy } from "./app";
import { logger } from "./lib/logger";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const server = app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});

// In development, forward HMR WebSocket upgrades to the Vite dev server so hot
// module reload works through this server's proxy. No-op in production. The
// /api and /sitemap.xml prefixes are excluded to match the HTTP pathFilter and
// avoid future WebSocket route conflicts.
if (devViteProxy) {
  const proxy = devViteProxy;
  server.on("upgrade", (req, socket, head) => {
    const url = req.url ?? "";
    if (url.startsWith("/api") || url.startsWith("/sitemap.xml")) return;
    proxy.upgrade(req, socket as import("node:net").Socket, head);
  });
}
