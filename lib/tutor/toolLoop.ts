// lib/tutor/toolLoop.ts — one tutor answer with tools (G4; DESIGN §4 step 7, §5).
// The model may ask for math_check / make_sibling; the server runs them and sends the results back.
// At most MAX_TOOL_ROUNDS rounds, inside the turn's time budget; then tool_choice "none" forces the JSON.
// Sonnet/Opus 5.5 always think: their thinking blocks must go back unchanged with the tool_use blocks,
// and a specific tool cannot be forced — the app can only ask in words (review).
import type { Msg, SystemBlock } from "@/lib/tutor/assemble";
import type { TutorOutput } from "@/lib/tutor/schema";
import { TOOL_DEFS, type ToolName, type ToolRecord } from "@/lib/tools/defs";
import { runTutorTurn, type ContentPart, type ModelClient } from "@/lib/tutor/turn";

export const MAX_TOOL_ROUNDS = 3;
/** A tool round (tools + one more model call) is only started with this much of the turn budget left. */
export const TOOL_ROUND_NEEDS_MS = 70_000;

export type Answer = Awaited<ReturnType<typeof runTutorTurn>>;
export type ToolRunner = (name: string, input: unknown) => Promise<{ ok: boolean; output: unknown }>;
export interface LoopResult {
  /** the call whose JSON is the answer (output may still be null) */
  final: Answer;
  /** every model call of this answer, in order (each is paid and logged) */
  calls: Answer[];
  /** `round` = index in `calls` of the call that asked for the tool */
  tools: ToolRecord[];
}

export async function runToolLoop(client: ModelClient, req: {
  model: string; system: SystemBlock[]; messages: Msg[]; run: ToolRunner;
  timeLeft: () => number;
  /** after a JSON answer: words that send it back for one more round, or null */
  review?: (output: TutorOutput | null, tools: readonly ToolRecord[]) => string | null;
}): Promise<LoopResult> {
  const messages: Msg[] = [...req.messages];
  const calls: Answer[] = [];
  const tools: ToolRecord[] = [];
  let toolRounds = 0;
  let reviewed = false;
  let force = false;

  for (;;) {
    const answer = await runTutorTurn(client, { model: req.model, system: req.system, messages: [...messages], tools: TOOL_DEFS,
      toolChoice: force ? { type: "none" } : { type: "auto" } });
    calls.push(answer);
    const round = calls.length - 1;
    const asks = answer.content.filter((c) => c.type === "tool_use");

    if (answer.stopReason === "tool_use" && asks.length > 0) {
      if (force) return { final: answer, calls, tools }; // the model ignored "none": give up on this answer
      messages.push({ role: "assistant", content: answer.content as Msg["content"] });
      if (toolRounds >= MAX_TOOL_ROUNDS || req.timeLeft() < TOOL_ROUND_NEEDS_MS) {
        // No more tools: answer each request with "not run" and force the final JSON.
        messages.push({ role: "user", content: asks.map((a) => toolResult(a, { ok: false, error: "no_more_tool_calls" }, true)) as Msg["content"] });
        force = true;
        continue;
      }
      toolRounds++;
      const results: ContentPart[] = [];
      for (const a of asks) {
        const started = Date.now();
        const r = await req.run(a.name ?? "", a.input);
        tools.push({ tool: (a.name ?? "unknown") as ToolName, input: a.input, output: r.output, ok: r.ok, ms: Date.now() - started, round });
        results.push(toolResult(a, r.output, !r.ok));
      }
      messages.push({ role: "user", content: results as Msg["content"] });
      continue;
    }

    const nudge = !reviewed && !force && req.review ? req.review(answer.output, tools) : null;
    if (nudge && toolRounds < MAX_TOOL_ROUNDS && req.timeLeft() >= TOOL_ROUND_NEEDS_MS) {
      reviewed = true;
      messages.push({ role: "assistant", content: answer.content as Msg["content"] });
      messages.push({ role: "user", content: `[APP] ${nudge}` });
      continue;
    }
    return { final: answer, calls, tools };
  }
}

function toolResult(ask: ContentPart, output: unknown, isError: boolean): ContentPart {
  return { type: "tool_result", tool_use_id: ask.id, content: JSON.stringify(output), is_error: isError };
}
