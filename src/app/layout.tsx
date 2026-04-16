import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Makada Properties",
  description: "Internal operating tool for Makada Properties.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
