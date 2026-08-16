import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Нужен self-hosted (Docker) деплой: Vercel по-прежнему поддерживается.
  output: "standalone",
  // Позволяет открывать dev-сервер с этого Mac на телефоне в локальной сети.
  allowedDevOrigins: ["127.0.0.1", "192.168.1.30"],
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
  poweredByHeader: false,
  images: {
    formats: ["image/avif", "image/webp"],
    deviceSizes: [640, 960, 1280],
    imageSizes: [96, 128, 256, 384],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

export default nextConfig;
