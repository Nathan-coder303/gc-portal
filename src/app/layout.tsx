import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GC Portal",
  description: "General Contractor Project Finance & Schedule Portal",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
