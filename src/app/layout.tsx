import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MZAN Capital",
  description: "Internal operating tool for MZAN Capital.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
