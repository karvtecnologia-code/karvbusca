import type { NextConfig } from "next";

const config: NextConfig = {
  transpilePackages: ["@karv/core"],
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**.supabase.co" }],
  },
};

export default config;
