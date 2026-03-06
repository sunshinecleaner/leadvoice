/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  transpilePackages: ["@leadvoice/shared"],
};

module.exports = nextConfig;
