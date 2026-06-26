import type { Metadata, Viewport } from "next";
import "./globals.css";
import { PwaRegister } from "@/components/pwa-register";

export const metadata: Metadata = {
  title: "밥심 식사배달관리",
  description: "거래처 식수 변경, 거절, 배달표, 월별 집계를 관리하는 밥심 운영 앱입니다.",
  appleWebApp: {
    capable: true,
    title: "밥심 식사배달관리",
    statusBarStyle: "default"
  },
  icons: {
    icon: "/bapsim-logo.png",
    apple: "/bapsim-logo.png"
  }
};

export const viewport: Viewport = {
  themeColor: "#c8191f",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="overflow-x-hidden bg-stone-50 text-stone-900 selection:bg-bapsim-red/20">
        <PwaRegister />
        {children}
      </body>
    </html>
  );
}
