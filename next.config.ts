import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // промпты читаются через fs в route handlers — включаем их в бандл функций
  outputFileTracingIncludes: { '/api/**': ['./prompts/**'] },
  cacheComponents: true,
  partialPrefetching: true,
};

export default nextConfig;
