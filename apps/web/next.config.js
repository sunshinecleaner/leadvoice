/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  transpilePackages: ["@leadvoice/shared"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "sunshinebrazilian.com",
        pathname: "/wp-content/uploads/**",
      },
      {
        protocol: "https",
        hostname: "github.com",
        pathname: "/n8ndevelop/logo/**",
      },
    ],
  },
};

module.exports = nextConfig;
