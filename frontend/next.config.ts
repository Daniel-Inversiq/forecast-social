import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";
import path from "path";
import { fileURLToPath } from "url";

const frontendRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  // Allow both loopback hostnames — Next.js blocks /_next/* and HMR when Origin
  // (e.g. http://127.0.0.1:3000) does not match the hostname the dev server bound to.
  allowedDevOrigins: ["127.0.0.1", "localhost", "*.localhost"],
  turbopack: {
    root: frontendRoot,
  },
  async redirects() {
    return [
      { source: "/rivalries", destination: "/battles", permanent: true },
      { source: "/receipts", destination: "/verified-calls", permanent: false },
    ];
  },
};

const sentryDsn = process.env.NEXT_PUBLIC_SENTRY_DSN?.trim();

export default sentryDsn
  ? withSentryConfig(nextConfig, {
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      silent: !process.env.CI,
      widenClientFileUpload: true,
      disableLogger: true,
      automaticVercelMonitors: false,
    })
  : nextConfig;
