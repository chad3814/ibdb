import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  images: {
    loader: 'default',
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.isbndb.com',
        port: '',
        pathname: '/covers/**',
        search: '',
      },
    ],
  },
};

export default nextConfig;
