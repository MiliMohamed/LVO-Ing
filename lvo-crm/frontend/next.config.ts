import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Build Docker : voir deploy/DEPLOY.md.
  output: "standalone",
  // Projet npm autonome (lockfile propre) : on épingle la racine de tracing sur ce
  // dossier, ce qui évite aussi que Next remonte au lockfile du monorepo parent.
  outputFileTracingRoot: __dirname,
  async rewrites() {
    // Pointe sur le service CRM séparé (server/), port 8081 par défaut.
    const apiBase = process.env.API_BASE_URL?.replace(/\/$/, "")
      || `http://127.0.0.1:${process.env.API_PORT || "8081"}`;
    return [
      {
        source: "/api/:path*",
        destination: `${apiBase}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
