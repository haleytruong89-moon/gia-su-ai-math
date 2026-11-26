import { serve } from "@/lib/tutor/deps";
import { tickPlan } from "@/lib/tutor/handlers";

export const dynamic = "force-dynamic";

/** D38: tick / untick one job of "Bài của em" (no model call). */
export function POST(req: Request) {
  return serve(tickPlan, req);
}
