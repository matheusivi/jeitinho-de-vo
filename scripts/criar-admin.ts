/**
 * Cria uma conta de administradora pelo terminal do servidor.
 * Uso: npx tsx scripts/criar-admin.ts "Nome" email@exemplo.com 'senha'
 */
import "dotenv/config";
import { pool } from "../src/lib/db";
import { createUser } from "../src/lib/auth/users";

async function main() {
  const [name, email, password] = process.argv.slice(2);
  if (!name || !email || !password) {
    console.error('Uso: npx tsx scripts/criar-admin.ts "Nome" email@exemplo.com \'senha\'');
    process.exitCode = 1;
    return;
  }
  const r = await createUser({ name, email, password, role: "ADMIN" });
  if (!r.ok) {
    console.error(`Não criei: ${r.message}`);
    process.exitCode = 1;
    return;
  }
  console.log(`Conta de administradora criada para ${email}.`);
}

main().finally(() => pool.end());
