import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'fdnqjwezvkcpwckyqmbg.supabase.co',
      },
    ],
  },
};

export default nextConfig;
