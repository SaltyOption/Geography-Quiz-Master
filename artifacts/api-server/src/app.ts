import express, { type Express, type RequestHandler } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { sep } from "path";
import { clerkMiddleware } from "@clerk/express";
import { CLERK_PROXY_PATH, clerkProxyMiddleware } from "./middlewares/clerkProxyMiddleware";
import { createDevViteProxy } from "./middlewares/devViteProxy";
import router from "./routes";
import ssrPagesRouter from "./routes/ssr-pages";
import sitemapRouter from "./routes/sitemap";
import { BUNDLED_PUBLIC_DIR } from "./lib/ssrTemplate";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());

app.use(cors({ credentials: true, origin: true }));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

app.use(clerkMiddleware());

// /sitemap.xml at the root path — served live from the database so crawlers
// always see the current URL inventory, not a snapshot frozen at deploy time.
app.use(sitemapRouter);

// API routes first — must be registered before ssrPagesRouter so the /*splat
// SPA catch-all in ssrPagesRouter never intercepts /api/* requests.
app.use("/api", router);

// Frontend delivery differs by environment:
// - Production: the API server owns "/" and renders fresh SSR HTML for crawlers
//   (ssrPagesRouter), built from the prebuilt frontend in geo-quiz/dist/public.
// - Development: that build doesn't exist, so forward all non-API traffic to the
//   running Vite dev server instead. This keeps the preview a fully styled,
//   hot-reloading SPA. The instance is exported so index.ts can also forward HMR
//   WebSocket upgrades.
export const devViteProxy: ReturnType<typeof createDevViteProxy> | undefined =
  process.env.NODE_ENV === "development" ? createDevViteProxy() : undefined;

if (devViteProxy) {
  app.use(devViteProxy as unknown as RequestHandler);
} else {
  // Production: serve the frontend's hashed assets (JS/CSS), images, and other
  // static files from the build bundled inside this server (see build.mjs). This
  // makes the api-server the single source of truth for both the SSR shell and
  // the assets it references, so they can never diverge from the separately built
  // static layer (an asset request that misses that layer falls through here).
  // `index: false` + `redirect: false` keep every HTML route owned by the SSR
  // handlers below — no directory index.html snapshots are served and no
  // trailing-slash redirects are issued; only real asset files are served here.
  app.use(
    express.static(BUNDLED_PUBLIC_DIR, {
      index: false,
      redirect: false,
      setHeaders: (res, filePath) => {
        if (filePath.includes(`${sep}assets${sep}`)) {
          res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        }
      },
    }),
  );
  app.use(ssrPagesRouter);
}

export default app;
