import { requireUser } from "@/lib/auth/guard";
import { recentJobs } from "@/lib/printing/jobs";
import { ComandasClient } from "./ComandasClient";

export const metadata = { title: "Comandas · Jeitinho de Vó" };

export default async function ComandasPage() {
  await requireUser();
  const jobs = (await recentJobs(30)).map((j) => ({ ...j, createdAt: j.createdAt.toISOString(), printedAt: j.printedAt?.toISOString() ?? null }));
  return <ComandasClient initial={jobs} />;
}
