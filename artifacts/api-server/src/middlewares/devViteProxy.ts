/**
 * Development-only proxy to the geo-quiz Vite dev server.
 *
 * In production the API server owns "/" and renders SSR HTML (see ssr-pages.ts)
 * from the built frontend at artifacts/geo-quiz/dist/public. That build does not
 * exist during development, so instead we forward every non-API request to the
 * running Vite dev server. This restores the fully styled SPA (with hot module
 * reload) in the workspace preview, while production SSR stays untouched.
 *
 * The Vite dev server origin is fixed by the geo-quiz artifact (PORT=26064);
 * override it with WEB_DEV_URL if that ever changes.
 */
import {
  createProxyMiddleware,
  type RequestHandler as ProxyRequestHandler,
} from "http-proxy-middleware";

const WEB_DEV_URL = process.env.WEB_DEV_URL ?? "http://localhost:26064";

export function createDevViteProxy(): ProxyRequestHandler {
  return createProxyMiddleware({
    target: WEB_DEV_URL,
    changeOrigin: true,
    ws: true,
    // Only frontend traffic should reach Vite. /api/* (incl. the Clerk proxy)
    // and /sitemap.xml are served by this server's own routes.
    pathFilter: (pathname: string) =>
      !pathname.startsWith("/api") && !pathname.startsWith("/sitemap.xml"),
  });
}
