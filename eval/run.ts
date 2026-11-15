// eval/run.ts — G0: run the pedagogy test set on several models and score it (hub BO_TEST v0.2 §1, §3).
// Usage: ANTHROPIC_API_KEY=… npm run eval [-- --models=claude-haiku-5-5,claude-sonnet-5-5 --cases=9.1,6.2 --out=eval/results/x]
// Calls the real API (costs money). Run from GitHub Actions ("Bộ test sư phạm") so the key stays in a secret.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { costUsd, withRetry } from "@/lib/anthropic";
import { assemble, type TurnStateBlock } from "@/lib/tutor/assemble";
import { loadLayers, promptVersion } from "@/lib/tutor/layers";
import { runTutorTurn, type Effort, type ModelClient } from "@/lib/tutor/turn";
import fewshot from "../tests/fixtures/fewshot.json";
import { CASES, type EvalCase } from "./cases";
import { checkOutput } from "./checks";
import { TEST_PROFILES } from "./profiles";

const JUDGE_MODEL = "claude-haiku-5-5";
const effort = (process.env.EFFORT as Effort | undefined) || "medium";
const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];
const models = (arg("models") || "claude-haiku-5-5,claude-sonnet-5-5,claude-opus-5-5").split(",").filter(Boolean);
const only = arg("cases")?.split(",").filter(Boolean);
const outDir = arg("out") ?? join("eval", "results", new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-"));

// EVAL_FAKE=1: no API call, canned replies — checks the pipeline and the summary for free.
const fake: ModelClient = {
  async create(req) {
    const r = req as { messages: { content: string }[] };
    const isJudge = r.messages[0]?.content.startsWith("Em chấm");
    const text = isJudge
      ? JSON.stringify({ leaks_original_answer: false, ends_with_question_or_small_task: true, rubric_met: true, reason: "giả lập" })
      : JSON.stringify((fewshot as object[])[1]);
    return { content: [{ type: "text", text }], usage: { input_tokens: 1000, output_tokens: 100 } };
  },
};
function realClient(): ModelClient {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY is missing");
  const sdk = new Anthropic({ apiKey: key, maxRetries: 2, timeout: 90_000 });
  return withRetry({ create: (req) => sdk.messages.create(req as never) as never }, 2000);
}
const client = process.env.EVAL_FAKE ? fake : realClient();

const verdict = z.object({
  leaks_original_answer: z.boolean(),
  ends_with_question_or_small_task: z.boolean(),
  rubric_met: z.boolean(),
  reason: z.string(),
}).strict();
const verdictSchema = { ...z.toJSONSchema(verdict, { target: "draft-2020-12" }), additionalProperties: false };

async function judge(c: EvalCase, message: string, buttons: string[]) {
  const prompt = [
    "Em chấm một lượt trả lời của một gia sư Toán AI cho học sinh. Gia sư KHÔNG được đưa lời giải hay đáp số của bài gốc trước khi học sinh tự làm ra.",
    `Lớp ${c.grade}. Tình huống: ${c.title}.`,
    `Đáp số bài gốc (chỉ để em đối chiếu): ${c.answer}`,
    `Tin cuối của học sinh: ${c.childText}`,
    `Lượt trả lời của gia sư:\n<<<\n${message}\n>>>`,
    `Nút bấm gia sư đưa cho học sinh: ${buttons.length ? buttons.map((b) => `[${b}]`).join(" ") : "(không có)"}`,
    `Yêu cầu riêng của tình huống: ${c.rubric}`,
    "Chấm cả lời lẫn nút bấm. leaks_original_answer = gia sư nói ra, xác nhận, hoặc đặt sẵn trong nút / danh sách gợi ý đáp số hay lời giải trọn của bài gốc mà học sinh chưa tự đưa ra. ends_with_question_or_small_task = lượt kết thúc bằng câu hỏi hoặc một bước nhỏ cho em tự làm. rubric_met = đạt yêu cầu riêng. reason = một câu tiếng Việt.",
  ].join("\n\n");
  const res = await client.create({
    model: JUDGE_MODEL, max_tokens: 2000, thinking: { type: "disabled" }, messages: [{ role: "user", content: prompt }],
    output_config: { effort: "low", format: { type: "json_schema", schema: verdictSchema } },
  });
  const text = res.content.filter((p) => p.type === "text").map((p) => p.text ?? "").join("");
  let json: unknown = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  const parsed = verdict.safeParse(json);
  return { verdict: parsed.success ? parsed.data : null, costUsd: costUsd(JUDGE_MODEL, res.usage) };
}

const baseState: TurnStateBlock = { grade: 9, hintLevel: 0, wrongCount: 0, nan: false, idle: false, submitted: false,
  mode: "thuong", minutesLeft: 30, turn: 1, stuckKind: null, kuCode: null, examSlot: null };

async function runCase(model: string, c: EvalCase) {
  const profile = TEST_PROFILES[c.grade];
  const { system, messages } = assemble({
    layers: loadLayers(), profileText: profile.text, knowledgeCard: null, history: c.history, childText: c.childText,
    state: { ...baseState, grade: c.grade, ...c.state },
  });
  const started = Date.now();
  try {
    const r = await runTutorTurn(client, { model, system, messages, effort });
    const ms = Date.now() - started;
    const auto = checkOutput(r.output, { maxLines: profile.maxLines, forbid: c.forbid, expect: c.expect });
    const j = r.output ? await judge(c, r.output.message, r.output.buttons) : { verdict: null, costUsd: 0 };
    const failures = [...auto.failures];
    if (j.verdict?.leaks_original_answer) failures.push("judge:leak");
    if (j.verdict && !j.verdict.ends_with_question_or_small_task) failures.push("judge:no_question");
    if (j.verdict && !j.verdict.rubric_met) failures.push("judge:rubric");
    if (r.output && !j.verdict) failures.push("judge:unreadable");
    return { model, id: c.id, title: c.title, pass: failures.length === 0, failures,
      leak: auto.leak || j.verdict?.leaks_original_answer === true,
      lengthOk: !auto.failures.some((f) => f.startsWith("lines:")),
      endsOk: j.verdict?.ends_with_question_or_small_task ?? false,
      judgeReason: j.verdict?.reason ?? null, output: r.output, raw: r.output ? undefined : r.raw, stopReason: r.stopReason,
      costUsd: r.costUsd, judgeCostUsd: j.costUsd, ms, tokens: r.tokens };
  } catch (e) {
    return { model, id: c.id, title: c.title, pass: false, failures: [`error:${e instanceof Error ? e.message.slice(0, 400) : "unknown"}`],
      leak: false, lengthOk: false, endsOk: false, judgeReason: null, output: null, costUsd: 0, judgeCostUsd: 0, ms: Date.now() - started };
  }
}

type Row = Awaited<ReturnType<typeof runCase>>;

async function pool<T, R>(items: T[], size: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  let i = 0;
  await Promise.all(Array.from({ length: size }, async () => {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx]!);
    }
  }));
  return out;
}

const pct = (n: number, d: number) => (d ? `${Math.round((100 * n) / d)}%` : "—");

function summary(rows: Row[], caseCount: number): string {
  const lines = [
    `# Bộ test sư phạm — ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC`,
    "",
    `Prompt ${promptVersion()} · effort ${effort} · ${caseCount} tình huống chữ có trong bộ chạy (BO_TEST v0.2, chưa gồm ảnh và công cụ) · chấm phụ: ${JUDGE_MODEL}`,
    "",
    "| Model | Đạt hết | (a) Lộ đáp số | (b) Độ dài + kết bằng câu hỏi | Lỗi định dạng | Bị cắt (max_tokens) | Chi phí | Thời gian TB |",
    "|---|---|---|---|---|---|---|---|",
  ];
  for (const m of models) {
    const r = rows.filter((x) => x.model === m);
    const leaks = r.filter((x) => x.leak).length;
    const b = r.filter((x) => x.lengthOk && x.endsOk).length;
    const fmt = r.filter((x) => x.failures.includes("format")).length;
    const cut = r.filter((x) => "stopReason" in x && x.stopReason === "max_tokens").length;
    const cost = r.reduce((s, x) => s + x.costUsd + x.judgeCostUsd, 0);
    const avg = r.length ? Math.round(r.reduce((s, x) => s + x.ms, 0) / r.length / 100) / 10 : 0;
    lines.push(`| ${m} | ${r.filter((x) => x.pass).length}/${r.length} | ${leaks === 0 ? "✅ 0" : `❌ ${leaks}`} | ${pct(b, r.length)} ${b / Math.max(r.length, 1) >= 0.9 ? "✅" : "❌"} | ${fmt} | ${cut} | ${cost.toFixed(3)} USD | ${avg} s |`);
  }
  lines.push("", "Tiêu chí chọn (BO_TEST §1): model rẻ nhất có (a) 0 lần lộ đáp số và (b) ≥ 90%. (c) đọc ảnh và (d) gọi `math_check` chạy ở các lần sau (G3, G4).", "");
  lines.push("## Tình huống chưa đạt", "", "| Model | # | Tình huống | Lỗi | Nhận xét của bộ chấm |", "|---|---|---|---|---|");
  for (const r of rows.filter((x) => !x.pass))
    lines.push(`| ${r.model} | ${r.id} | ${r.title} | ${r.failures.join(", ")} | ${(r.judgeReason ?? "").replace(/\|/g, "/")} |`);
  return lines.join("\n") + "\n";
}

async function main() {
  const cases = only ? CASES.filter((c) => only.includes(c.id)) : CASES;
  mkdirSync(outDir, { recursive: true });
  const jobs = models.flatMap((m) => cases.map((c) => ({ m, c })));
  console.log(`Running ${jobs.length} turns (${models.join(", ")}) → ${outDir}`);
  const rows = await pool(jobs, 4, async ({ m, c }) => {
    const r = await runCase(m, c);
    console.log(`${r.pass ? "PASS" : "FAIL"} ${m} ${c.id} ${r.failures.join(",")}`);
    return r;
  });
  for (const m of models)
    writeFileSync(join(outDir, `${m}.jsonl`), rows.filter((r) => r.model === m).map((r) => JSON.stringify(r)).join("\n") + "\n");
  const md = summary(rows, cases.length);
  writeFileSync(join(outDir, "SUMMARY.md"), md);
  if (process.env.GITHUB_STEP_SUMMARY) writeFileSync(process.env.GITHUB_STEP_SUMMARY, md, { flag: "a" });
  console.log(md);
  // Every turn failed before the tutor answered (bad key, bad request…): make the run red.
  if (rows.every((r) => r.failures.some((f) => f.startsWith("error:")))) process.exitCode = 1;
}

void main();
