import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { clerkMiddleware } from "@clerk/express";
import { CLERK_PROXY_PATH, clerkProxyMiddleware } from "./middlewares/clerkProxyMiddleware";
import router from "./routes";
import ssrPagesRouter from "./routes/ssr-pages";
import sitemapRouter from "./routes/sitemap";
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

// SSR page routes — serve /, /quiz/:id, /category/:slug, /courses, /courses/:slug
// as fresh SSR HTML, and fall back to the SPA template for all other paths
// (/profile, /admin/*, /daily, etc.) so the React app handles them client-side.
app.use(ssrPagesRouter);

export default app;
