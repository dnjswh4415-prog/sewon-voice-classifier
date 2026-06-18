import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sewon Voice Classifier",
  description: "Korean call recording intake classifier"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
