import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    // Pointe sur le service CRM séparé (lvo-crm/server), port 8081 par défaut.
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
