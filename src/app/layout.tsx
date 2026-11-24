import type { Metadata } from "next";
// fontes servidas pelo próprio site (sem Google Fonts): mais rápido, sem depender de terceiros
// e sem repassar dados de quem visita
import "@fontsource/caprasimo/latin-400.css";
import "@fontsource/hanken-grotesk/latin-400.css";
import "@fontsource/hanken-grotesk/latin-500.css";
import "@fontsource/hanken-grotesk/latin-600.css";
import "@fontsource/hanken-grotesk/latin-700.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Jeitinho de Vó · Doceria artesanal",
  description: "Doceria artesanal em Nova Andradina, MS, com entrega e retirada na loja.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
