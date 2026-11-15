import { serve } from "@/lib/tutor/deps";
import { saveForLater } from "@/lib/tutor/handlers";

export const dynamic = "force-dynamic";

export function POST(req: Request) {
  return serve(saveForLater, req);
}
