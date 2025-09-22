import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 开发时优化
  reactStrictMode: false, // 减少重复渲染

  // 构建优化
  experimental: {
    turbo: {
      // 启用turbopack (更快的bundler)
    }
  },

  // 减少不必要的检查
  typescript: {
    ignoreBuildErrors: false
  },

  // 缓存优化
  onDemandEntries: {
    maxInactiveAge: 25 * 1000,
    pagesBufferLength: 2,
  },

  // 压缩配置
  compress: true,
};

export default nextConfig;
