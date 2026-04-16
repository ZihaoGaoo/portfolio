import type { ReactNode } from "react";
import type { Metadata } from "next";

import "@unocss/reset/tailwind.css";
import "katex/dist/katex.min.css";
import "../styles/index.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "playground-macos",
  description: "My portfolio website simulating macOS's GUI."
};

interface RootLayoutProps {
  children: ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
