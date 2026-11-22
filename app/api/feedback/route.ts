import { serve } from "@/lib/tutor/deps";
import { flagMessage } from "@/lib/tutor/feedback";

export const dynamic = "force-dynamic";

/** D32: the child flags one tutor message ("Cô sai ở đây"). */
export function POST(req: Request) {
  return serve(async (d, body) => flagMessage(d, body), req);
}
