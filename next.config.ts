import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Inert by default (falls back to .next). Set NEXT_PREVIEW_DISTDIR to run a
  // second `next dev` for this project dir without hitting Next 16's per-distDir
  // lock (used to preview working-tree changes when another dev server is up).
  ...(process.env.NEXT_PREVIEW_DISTDIR
    ? { distDir: process.env.NEXT_PREVIEW_DISTDIR }
    : {}),
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
