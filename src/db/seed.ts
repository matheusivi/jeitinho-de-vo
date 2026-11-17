import "dotenv/config";
import { db, pool, schema } from "../lib/db";
import { createUser } from "../lib/auth/users";

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) throw new Error("Defina ADMIN_EMAIL e ADMIN_PASSWORD no .env");

  const admins = await db.select({ id: schema.users.id }).from(schema.users);
  if (admins.length === 0) {
    const r = await createUser({ name: "Administradora", email, password, role: "ADMIN" });
    console.log(r.ok ? `Admin criado: ${email}` : `Não foi possível criar o admin: ${r.message}`);
  } else {
    console.log("Já existe usuário cadastrado; admin não recriado.");
  }

  const cats = ["Fatias", "Copos da Felicidade", "Bolos artesanais", "Bolos recheados"];
  for (const [i, name] of cats.entries()) {
    await db
      .insert(schema.categories)
      .values({ name, slug: name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-"), position: i })
      .onConflictDoNothing();
  }

  // Bairros de exemplo: trocar pelos valores reais em /painel/bairros.
  const bairros: [string, number][] = [["Centro", 500], ["Exemplo: bairro próximo", 700], ["Exemplo: bairro distante", 1000]];
  for (const [name, feeCents] of bairros) {
    await db.insert(schema.neighborhoods).values({ name, feeCents }).onConflictDoNothing();
  }
  console.log("Categorias e bairros de exemplo conferidos.");
}

main().finally(() => pool.end());
