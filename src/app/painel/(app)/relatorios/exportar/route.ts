import { currentUser, needsMfaSetup } from "@/lib/auth/guard";
import { buildMonthWorkbook } from "@/lib/reports/excel";

export const dynamic = "force-dynamic";

/** Planilha do mês. Só a dona; funcionária e visitante recebem 403/401 sem nenhum dado. */
export async function GET(req: Request): Promise<Response> {
  const user = await currentUser();
  if (!user) return new Response("Faça login.", { status: 401 });
  if (user.role !== "ADMIN" || needsMfaSetup(user)) return new Response("Sem acesso.", { status: 403 });
  const m = /^(\d{4})-(\d{2})$/.exec(new URL(req.url).searchParams.get("mes") ?? "");
  if (!m) return new Response("Mês inválido.", { status: 400 });
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (year < 2025 || year > 2100 || month < 1 || month > 12) return new Response("Mês inválido.", { status: 400 });
  const buf = await buildMonthWorkbook(year, month, user);
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="jeitinho-de-vo-${m[1]}-${m[2]}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
