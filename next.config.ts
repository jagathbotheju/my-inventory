import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // distDir: "build",
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "utfs.io",
      },
    ],
  },
};

export default nextConfig;
