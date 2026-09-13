import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [{ protocol: "https", hostname: "images.pexels.com" }],
  },
  // 关掉左下角的开发态浮标：它会出现在文档截图里，且对本项目没有实际用处
  devIndicators: false,
};

export default nextConfig;
