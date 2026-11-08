import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Nenhum fluxo envia arquivo; o maior corpo legítimo (wizard com duas descrições) fica bem abaixo disto.
  experimental: { serverActions: { bodySizeLimit: "100kb" } },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
