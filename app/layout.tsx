import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "heifdrop – Media, without the noise",
  description: "A clean, no-ad interface for saving media you have permission to download.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
