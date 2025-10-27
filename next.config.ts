import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: false,
  experimental: {
    turbo: {},
  },
  compress: true,
};

export default nextConfig;
