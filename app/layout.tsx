import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cô gia sư Toán",
  description: "Gợi ý từng bước khi em kẹt bài Toán",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#2b5d4f",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
