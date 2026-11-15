import { serve } from "@/lib/tutor/deps";
import { newProblem } from "@/lib/tutor/handlers";

export const dynamic = "force-dynamic";
// Up to 4 model calls (answer, check, rewrite, check) inside TURN_BUDGET_MS (lib/tutor/handlers.ts);
// must stay under STALE_PENDING_MS (5,5 minutes).
export const maxDuration = 300;

export function POST(req: Request) {
  return serve(newProblem, req);
}
