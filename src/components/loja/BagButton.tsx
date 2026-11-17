"use client";

import Link from "next/link";
import { useBag } from "./BagProvider";

export function BagButton() {
  const { count, ready } = useBag();
  return (
    <Link className="lj-sacola" href="/sacola" aria-label={`Sacola, ${count} ${count === 1 ? "item" : "itens"}`}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M5 8h14l-1.2 11.1a2 2 0 0 1-2 1.9H8.2a2 2 0 0 1-2-1.9L5 8z" />
        <path d="M9 8V6a3 3 0 0 1 6 0v2" />
      </svg>
      <span>Sacola</span>
      <span className="lj-badge">{ready ? count : 0}</span>
    </Link>
  );
}
