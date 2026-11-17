import { Aviso } from "@/components/loja/Aviso";
import { BagProvider } from "@/components/loja/BagProvider";
import { Footer } from "@/components/loja/Footer";
import { Header } from "@/components/loja/Header";
import "./loja.css";

export const dynamic = "force-dynamic";

export default function LojaLayout({ children }: { children: React.ReactNode }) {
  return (
    <BagProvider>
      <div className="lj">
        <Aviso />
        <Header />
        {children}
        <Footer />
      </div>
    </BagProvider>
  );
}
