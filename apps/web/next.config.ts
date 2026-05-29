import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  async redirects() {
    return [
      // Старые пути → новые (для закладок/ссылок)
      { source: '/manager', destination: '/', permanent: true },
      { source: '/profile/:username', destination: '/u/:username', permanent: true },
    ];
  },
};

export default nextConfig;
