import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Static export for Capacitor mobile app
  output: 'export',
  // Trailing slash ensures correct file resolution on device WebView
  trailingSlash: true,
  // Disable image optimization (not supported in static export)
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
