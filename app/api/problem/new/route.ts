import { serve } from "@/lib/tutor/deps";
import { newProblem } from "@/lib/tutor/handlers";

export const dynamic = "force-dynamic";
// One model call with one retry (lib/anthropic.ts): stay under STALE_PENDING_MS (2,5 minutes).
export const maxDuration = 120;

export function POST(req: Request) {
  return serve(newProblem, req);
}
