import path from "node:path";
import { fileURLToPath } from "node:url";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: process.env.DOCKER_BUILD === "true" ? "standalone" : undefined,
  async rewrites() {
    return process.env.DOCKER_BUILD === "true"
      ? [{ source: "/api/:path*", destination: "http://api:4000/api/:path*" }]
      : [];
  },
  outputFileTracingRoot: path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../.."),
};

export default nextConfig;
