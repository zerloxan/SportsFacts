/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // shared-types ships as TS-built ESM; let Next transpile the workspace pkg.
  transpilePackages: ["@sportsfacts/shared-types"],
};

export default nextConfig;
