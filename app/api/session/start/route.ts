import { serve } from "@/lib/tutor/deps";
import { startSession } from "@/lib/tutor/handlers";

export const dynamic = "force-dynamic";

export function POST(req: Request) {
  return serve(startSession, req);
}
