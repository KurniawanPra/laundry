import type { Metadata } from "next";
import type { Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "LaundryPOS - Kasir & Tracking Cucian",
  description: "Kelola transaksi dan pantau proses laundry dari desktop maupun ponsel.",
  applicationName: "LaundryPOS",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "LaundryPOS",
    statusBarStyle: "default",
  },
  icons: {
    icon: "/laundry-icon.svg",
    apple: "/laundry-icon.svg",
  },
};

export const viewport: Viewport = {
  themeColor: "#0891b2",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="id"
      className={`${geistSans.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
