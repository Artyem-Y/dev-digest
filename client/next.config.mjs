import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The hermetic browser stack can run beside a developer's Next server.
  distDir: process.env.E2E_HERMETIC === "1" ? ".next-e2e" : ".next",
  env: {
    NEXT_PUBLIC_API_BASE: process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:3001",
  },
};

export default withNextIntl(nextConfig);
