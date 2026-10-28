import type { Metadata } from "next";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "ФСП Оренбургская область",
  description:
    "Цифровая платформа Федерации спортивного программирования Оренбургской области",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru">
      <body>
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
