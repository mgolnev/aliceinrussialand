import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/favicon.ico",
        destination: "/icon",
        permanent: true,
      },
    ];
  },
  // Нужен self-hosted (Docker) деплой: Vercel по-прежнему поддерживается.
  output: "standalone",
  // Медиа копируются отдельным Docker-слоем. Эти локальные каталоги не должны
  // попадать в server trace даже при консервативном анализе fs-путей.
  outputFileTracingExcludes: {
    "/*": [
      ".git/**/*",
      "backups/**/*",
      "outputs/**/*",
      "public/media/**/*",
      "storage/**/*",
    ],
  },
  // Позволяет открывать dev-сервер с этого Mac на телефоне в локальной сети.
  allowedDevOrigins: ["127.0.0.1", "192.168.1.30", "10.77.4.77"],
  // Системная кнопка Next перекрывает мобильную панель форматирования.
  // Ошибки по-прежнему выводятся в overlay и консоль.
  devIndicators: false,
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
