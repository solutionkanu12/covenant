import type { NextConfig } from "next";

// The browser only ever calls the same-origin /api/* path; Next.js proxies it
// to the Covenant API server. This keeps the API host out of client code and
// avoids needing CORS on a backend that otherwise has no browser-facing origin.
const apiOrigin = (process.env.COVENANT_API_URL ?? "http://localhost:3001").replace(
  /\/$/,
  "",
);

// next build and next dev must never share a webpack output dir. Reusing
// .next produces "Cannot read properties of undefined (reading 'call')" in
// .next/static/chunks/webpack.js. Scripts set NEXT_DIST_DIR; NODE_ENV is
// the fallback so a raw `next dev` / `next build` stays isolated too.
const distDir =
  process.env.NEXT_DIST_DIR ??
  (process.env.NODE_ENV === "development" ? ".next-dev" : ".next");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  distDir,
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${apiOrigin}/api/:path*` }];
  },
  async redirects() {
    return [
      { source: "/legal/terms", destination: "/terms", permanent: false },
      { source: "/legal/privacy", destination: "/privacy", permanent: false },
    ];
  },
};

export default nextConfig;
