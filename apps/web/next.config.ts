import type { NextConfig } from "next";

// The browser only ever calls the same-origin /api/* path; Next.js proxies it
// to the Covenant API server. This keeps the API host out of client code and
// avoids needing CORS on a backend that otherwise has no browser-facing origin.
const apiOrigin = (process.env.COVENANT_API_URL ?? "http://localhost:3001").replace(
  /\/$/,
  "",
);

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${apiOrigin}/api/:path*` }];
  },
};

export default nextConfig;
