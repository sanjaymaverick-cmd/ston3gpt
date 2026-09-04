/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000",
  },
};

// Vercel performs its own output tracing. Standalone output is only needed by
// the production Docker image and breaks Vercel's monorepo build collector.
if (!process.env.VERCEL) nextConfig.output = "standalone";

module.exports = nextConfig;
