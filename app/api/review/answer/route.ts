import { serve } from "@/lib/tutor/deps";
import { answerReview } from "@/lib/tutor/review";

export const dynamic = "force-dynamic";

/** G6b: the child answers (or postpones) a start-of-session review question; the server grades it. */
export function POST(req: Request) {
  return serve(async (d, body) => answerReview(d, body), req);
}

