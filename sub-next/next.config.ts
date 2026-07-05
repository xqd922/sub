import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: false,
  compress: true,
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
