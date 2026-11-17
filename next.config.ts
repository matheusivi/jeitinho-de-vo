import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Todas as páginas dependem de estoque e sessão ao vivo, então ficam dinâmicas
  // no modelo clássico, sem Cache Components.
  serverExternalPackages: ["@node-rs/argon2", "sharp", "pg"],
};

export default nextConfig;
