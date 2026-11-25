"use server";

import { requireUser } from "@/lib/auth/guard";
import { claimJobs, getJob, markPrinted, recentJobs, type PrintJob } from "@/lib/printing/jobs";

type Wire = Omit<PrintJob, "createdAt" | "printedAt"> & { createdAt: string; printedAt: string | null };
const wire = (j: PrintJob): Wire => ({ ...j, createdAt: j.createdAt.toISOString(), printedAt: j.printedAt?.toISOString() ?? null });
const DEVICE = /^[a-z0-9-]{8,64}$/;

export async function claimAction(deviceId: string): Promise<Wire[]> {
  await requireUser();
  if (!DEVICE.test(deviceId)) return [];
  return (await claimJobs(deviceId, 5)).map(wire);
}

export async function printedAction(id: string, deviceId: string): Promise<void> {
  await requireUser();
  if (!DEVICE.test(deviceId)) return;
  await markPrinted(id, deviceId);
}

export async function reprintAction(id: string): Promise<Wire | null> {
  await requireUser();
  const j = await getJob(id);
  return j ? wire(j) : null;
}

export async function recentAction(): Promise<Wire[]> {
  await requireUser();
  return (await recentJobs(30)).map(wire);
}
