import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SportsFacts — Live Announcer Dashboard",
  description: "Real-time AI sports-commentary fact engine",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
