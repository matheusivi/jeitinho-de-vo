"use client";

import Link from "next/link";
import { useState } from "react";
import { useFormAction } from "@/components/useFormAction";
import { saveProductAction, type ProductFormState } from "./actions";

type Props = {
  categories: { id: string; name: string }[];
  product?: {
    id: string; name: string; description: string; price: string; unitLabel: string;
    categoryId: string; active: boolean; imageUrl: string | null;
  };
};

export function ProductForm({ categories, product }: Props) {
  const [state, onSubmit, pending] = useFormAction<ProductFormState>(saveProductAction, {});
  const [preview, setPreview] = useState<string | null>(product?.imageUrl ?? null);
  return (
    <form onSubmit={onSubmit} className="pn-card pn-grid" style={{ maxWidth: 720 }}>
      {product && <input type="hidden" name="id" value={product.id} />}
      <div className="pn-row" style={{ alignItems: "flex-start" }}>
        <div style={{ flex: "0 0 160px" }}>
          <div style={{ width: 160, height: 160, borderRadius: 16, border: "1.5px dashed #8fa0a2", background: "var(--surface)", overflow: "hidden", display: "grid", placeItems: "center" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {preview ? <img src={preview} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span className="pn-muted">Sem foto</span>}
          </div>
        </div>
        <div className="pn-field" style={{ flex: "1 1 260px" }}>
          <label htmlFor="pf-photo">Foto</label>
          <input
            id="pf-photo" name="photo" type="file" accept="image/jpeg,image/png,image/webp"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) setPreview(URL.createObjectURL(f));
            }}
          />
          <span className="pn-muted">Pode ser direto do celular. O sistema recorta em quadrado e deixa leve sozinho.</span>
        </div>
      </div>
      <div className="pn-field">
        <label htmlFor="pf-name">Nome</label>
        <input className="pn-input" id="pf-name" name="name" defaultValue={product?.name} required maxLength={80} />
      </div>
      <div className="pn-field">
        <label htmlFor="pf-desc">Descrição <span className="pn-muted">(opcional)</span></label>
        <textarea className="pn-input" id="pf-desc" name="description" defaultValue={product?.description} maxLength={300} />
      </div>
      <div className="pn-row" style={{ alignItems: "flex-start" }}>
        <div className="pn-field" style={{ flex: "1 1 140px" }}>
          <label htmlFor="pf-price">Preço (R$)</label>
          <input className="pn-input" id="pf-price" name="price" inputMode="decimal" placeholder="14,00" defaultValue={product?.price} required />
        </div>
        <div className="pn-field" style={{ flex: "1 1 180px" }}>
          <label htmlFor="pf-unit">Vendido por</label>
          <input className="pn-input" id="pf-unit" name="unitLabel" placeholder="fatia, copo, bolo inteiro" defaultValue={product?.unitLabel} maxLength={40} />
        </div>
        <div className="pn-field" style={{ flex: "1 1 200px" }}>
          <label htmlFor="pf-cat">Categoria</label>
          <select className="pn-input" id="pf-cat" name="categoryId" defaultValue={product?.categoryId ?? ""} required>
            <option value="" disabled>Escolha</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </div>
      <label className="pn-row" style={{ gap: 8 }}>
        <input type="checkbox" name="active" defaultChecked={product?.active ?? true} />
        Ativo (aparece na loja quando tiver estoque)
      </label>
      {state.error && <p className="pn-msg err" role="alert">{state.error}</p>}
      <div className="pn-row">
        <button className="pn-btn" type="submit" disabled={pending}>{pending ? "Salvando…" : "Salvar produto"}</button>
        <Link className="pn-btn ghost" href="/painel/produtos">Cancelar</Link>
      </div>
    </form>
  );
}
