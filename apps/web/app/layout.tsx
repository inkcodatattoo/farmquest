import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FarmQuest — Protótipo 0.1",
  description: "Primeiro protótipo jogável do FarmQuest"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
