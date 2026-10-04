import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      // Route renames from the navigation refactor: keep old bookmarks working.
      { source: "/matchups", destination: "/matchup", permanent: true },
      { source: "/data", destination: "/data-pipeline", permanent: true },
    ];
  },
};

export default nextConfig;
