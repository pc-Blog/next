import type { NextConfig } from "next";
import fs from "fs";
import path from "path";

// 读取 siteConfig.ts，获取 hasDomain 和 repo 字段
const raw = fs.readFileSync(path.join(process.cwd(), "lib", "siteConfig.ts"), "utf-8");
const hasDomain = /hasDomain:\s*true/.test(raw);
const repo = (raw.match(/repo:\s*"([^"]+)"/)?.[1]?.split("/")?.[1]) || "next";

// 无自定义域名时，所有路径前加仓库名
const prefix = hasDomain ? "" : `/${repo}`;

const nextConfig: NextConfig = {
  trailingSlash: true,
  output: process.env.STATIC_EXPORT === "true" ? "export" : "standalone",
  ...(process.env.STATIC_EXPORT === "true"
    ? {
        images: { unoptimized: true },
        basePath: prefix,
        ...(prefix ? { assetPrefix: `${prefix}/` } : {}),
      }
    : {}),
};

export default nextConfig;
