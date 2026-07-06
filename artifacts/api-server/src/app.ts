import express, {
  type Express,
  type NextFunction,
  type Request,
  type Response,
  type RequestHandler,
} from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { sep } from "path";
import { clerkMiddleware } from "@clerk/express";
import { publishableKeyFromHost } from "@clerk/shared/keys";
import {
  CLERK_PROXY_PATH,
  clerkProxyMiddleware,
  getClerkProxyHost,
} from "./middlewares/clerkProxyMiddleware";
import { createDevViteProxy } from "./middlewares/devViteProxy";
import router from "./routes";
import ssrPagesRouter from "./routes/ssr-pages";
import sitemapRouter from "./routes/sitemap";
import { BUNDLED_PUBLIC_DIR } from "./lib/ssrTemplate";
import { logger } from "./lib/logger";

const app: Express = express();

// Behind exactly one reverse proxy in production (the platform's load
// balancer), so trust a single hop: req.ip becomes the client address the
// proxy appended to X-Forwarded-For, and later spoofed entries are ignored.
// Rate limiting keys off req.ip and breaks if this is set to `true` (which
// would trust the client-controlled leftmost entry) or left unset (which
// would bucket everyone under the proxy's own address).
app.set("trust proxy", Number(process.env.TRUST_PROXY_HOPS ?? 1));

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

// Credentialed CORS must never reflect arbitrary origins: Clerk sessions are
// cookie-backed, so a wildcard here would let any website a signed-in admin
// visits read and mutate /api/* with the admin's cookies. Only our own
// domains may make credentialed cross-origin requests. Same-origin and
// non-browser requests carry no Origin header and are unaffected.
const allowedOrigins = new Set(
  [
    process.env.VITE_CANONICAL_DOMAIN,
    ...(process.env.CORS_ALLOWED_ORIGINS?.split(",") ?? []),
  ]
    .map((origin) => origin?.trim().replace(/\/+$/, ""))
    .filter((origin): origin is string => Boolean(origin)),
);
const isLocalhostOrigin = (origin: string): boolean =>
  /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
app.use(
  cors({
    credentials: true,
    origin: (origin, callback) => {
      const allowed =
        !origin ||
        allowedOrigins.has(origin) ||
        (process.env.NODE_ENV === "development" && isLocalhostOrigin(origin));
      callback(null, allowed);
    },
  }),
);
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

// Resolve the publishable key from the incoming request host so the same
// server can serve multiple Clerk custom domains (e.g. a platform preview
// domain and worldgeographytrivia.com). Falls back to CLERK_PUBLISHABLE_KEY when the
// host doesn't map to a custom domain. getClerkProxyHost is shared with
// clerkProxyMiddleware so both halves of the auth setup agree on the canonical
// hostname — otherwise sessions issued on a custom domain fail to validate.
app.use(
  clerkMiddleware((req) => ({
    publishableKey: publishableKeyFromHost(
      getClerkProxyHost(req) ?? "",
      process.env.CLERK_PUBLISHABLE_KEY,
    ),
  })),
);

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

// Terminal error handler. Without it, Express 5's default handler answers
// with an HTML error page (including a stack trace outside production),
// which breaks every JSON-parsing client on the unhappy path. Client errors
// raised by middleware (e.g. body-parser's 400 on malformed JSON) keep their
// status; everything else is an opaque 500 — details go to the log only.
app.use(
  (err: unknown, req: Request, res: Response, _next: NextFunction) => {
    logger.error({ err, url: req.url?.split("?")[0] }, "unhandled request error");
    if (res.headersSent) return;
    const status =
      typeof err === "object" && err !== null && "status" in err &&
      typeof err.status === "number" && err.status >= 400 && err.status < 500
        ? err.status
        : 500;
    const message = status === 500 ? "Internal server error" : (err as Error).message;
    if (req.path === "/api" || req.path.startsWith("/api/")) {
      res.status(status).json({ error: message });
    } else {
      res.status(status).type("text/plain").send(message);
    }
  },
);

export default app;
