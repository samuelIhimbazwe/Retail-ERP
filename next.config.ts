import type { NextConfig } from "next";
import path from "path";

// Parent lockfile at C:\Users\ihimb confuses Turbopack; pin root to this app.
const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(process.cwd()),
  },
  // Hide the Next.js route/dev indicator overlay in development
  devIndicators: false,
};

export default nextConfig;
