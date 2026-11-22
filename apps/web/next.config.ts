import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  transpilePackages: [
    "@wallora/shared",
    "@wallora/validation",
    "@wallora/domain",
    "@wallora/design-tokens",
    "@wallora/api-client",
  ],
  turbopack: {},
};

export default nextConfig;
