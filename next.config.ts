import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.join(__dirname),
    resolveAlias: {
      ws: {
        browser: "./src/lib/ws-browser-stub.ts",
      },
    },
  },
  webpack: (config, { dev }) => {
    if (dev) {
      config.watchOptions = {
        ...config.watchOptions,
        ignored: [
          "**/.git/**",
          "**/node_modules/**",
          "**/.next/**",
          "**/prisma/**/*.db",
          "**/prisma/**/*.db-*",
          "**/data/uploads/**",
          "**/data/private/**",
        ],
      };
    }
    return config;
  },
  experimental: {
    proxyClientMaxBodySize: "80mb",
  },
  serverExternalPackages: ["@prisma/client", "ws"],
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
  transpilePackages: ["three"],
};

export default nextConfig;
