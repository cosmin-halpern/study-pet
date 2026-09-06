import type { Metadata } from "next";
import { Newsreader, Karla } from "next/font/google";
import "./globals.css";

const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
});

const karla = Karla({
  variable: "--font-karla",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Study Pets",
  description: "A habit tracker for a self-directed programming curriculum.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${newsreader.variable} ${karla.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-paper text-navy">{children}</body>
    </html>
  );
}