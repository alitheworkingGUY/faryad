import type { NextConfig } from "next";

// Hostnames allowed to reach the dev server (phones come in through the
// Cloudflare quick tunnel, whose hostname changes on every run).
const tunnelHosts = ["*.trycloudflare.com"];
try {
  if (process.env.PUBLIC_BASE_URL) {
    tunnelHosts.push(new URL(process.env.PUBLIC_BASE_URL).hostname);
  }
} catch {
  // ignore a malformed PUBLIC_BASE_URL; the wildcard above still applies
}

const nextConfig: NextConfig = {
  // Faryad is a live dashboard: every screen reads fresh data, nothing is
  // prerendered from the database, so Cache Components stays off.
  serverExternalPackages: ["better-sqlite3"],
  allowedDevOrigins: tunnelHosts,
  devIndicators: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
