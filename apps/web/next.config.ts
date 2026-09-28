import type { NextConfig } from "next";

const apiInternalUrl =
  process.env.API_INTERNAL_URL ?? "http://api:3001";

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${apiInternalUrl}/api/:path*`
      }
    ];
  }
};

export default nextConfig;
