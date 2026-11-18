import { notFound, redirect } from "next/navigation";
import { getEntry } from "@/lib/auth";
import { problemThread, supabaseRepo } from "@/lib/db/supabaseRepo";
import { TopBar } from "../../top-bar";
import { Chat } from "./chat";

export const dynamic = "force-dynamic";

export default async function ProblemPage({ params }: { params: Promise<{ problemId: string }> }) {
  const entry = await getEntry();
  if (entry.kind !== "child") redirect("/"); // the start page explains what is missing
  const { problemId } = await params;
  const thread = await problemThread(problemId, entry.actor.userId);
  if (!thread) notFound();
  const rating = await supabaseRepo().ratingState(problemId, entry.actor.userId); // G7b: the "chấm cô" card (P2)
  return (
    <>
      <TopBar />
      <main className="mx-auto flex max-w-2xl flex-col gap-4 p-4 pb-72">
        <Chat initial={thread} rating={rating} />
      </main>
    </>
  );
}
