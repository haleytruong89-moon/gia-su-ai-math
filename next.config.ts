import type { NextConfig } from "next";

// Served under the Study Launcher's own address: the Launcher rewrites /gia-su/* here (D20), so
// both apps share the Supabase session cookie. Every page and asset therefore lives under /gia-su.
const nextConfig: NextConfig = {
  basePath: "/gia-su",
  reactStrictMode: true,
  poweredByHeader: false,
  // The prompt layers are read from prompts/*.md at run time (lib/tutor/layers.ts).
  outputFileTracingIncludes: { "/**": ["./prompts/**"] },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          // Camera stays allowed for photos of the problem (G3).
          { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), payment=(), usb=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
