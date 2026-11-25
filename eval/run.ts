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
import { type Effort, type ModelClient } from "@/lib/tutor/turn";
import { runToolLoop } from "@/lib/tutor/toolLoop";
import { runGuard } from "@/lib/tutor/guard";
import { toolSummary } from "@/lib/tutor/handlers";
import { httpCas } from "@/lib/tools/casClient";
import { runMathCheck } from "@/lib/tools/mathCheck";
import { runLookup } from "@/lib/tools/lookup";
import { knowledgeCard } from "@/lib/knowledge/card";
import { card, cardFitsGrade, cardIndexText, pickVariant } from "@/lib/knowledge/cards";
import { CARD_BUTTONS } from "@/lib/copy";
import { classifyProblem, EMPTY, type Classification } from "@/lib/tutor/classify";
import { makeSibling, type SiblingInput } from "@/lib/tools/makeSibling";
import type { ToolRecord } from "@/lib/tools/defs";
import fewshot from "../tests/fixtures/fewshot.json";
import { CASES, GUARD_CASES, type EvalCase, type GuardCase } from "./cases";
import { checkOutput, toolKeys } from "./checks";
import { sheet } from "./images";
import { TEST_PROFILES } from "./profiles";

const JUDGE_MODEL = "claude-haiku-5-5";
const GUARD_MODEL = "claude-haiku-5-5";
const SIBLING_MODEL = "claude-sonnet-5-5";
const CLASSIFY_MODEL = "claude-haiku-5-5";
// G4: the tool cases need cas running next to the eval (the workflow starts it). Without it math_check answers an error.
const cas = process.env.CAS_URL && process.env.CAS_SECRET ? httpCas(process.env.CAS_URL, process.env.CAS_SECRET) : null;
const effort = (process.env.EFFORT as Effort | undefined) || "medium";
const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];
const models = (arg("models") || "claude-haiku-5-5,claude-sonnet-5-5,claude-opus-5-5").split(",").filter(Boolean);
const only = arg("cases")?.split(",").filter(Boolean);
const outDir = arg("out") ?? join("eval", "results", new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-"));

// EVAL_FAKE=1: no API call, canned replies — checks the pipeline and the summary for free.
const fake: ModelClient = {
  async create(req) {
    const r = req as { messages: { content: unknown }[] };
    const isJudge = typeof r.messages[0]?.content === "string" && (r.messages[0].content as string).startsWith("Em chấm");
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

/**
 * G6: what the child really sees when the tutor names a card — the server picks the way (C1) and shows the approved
 * card word for word under the message, with the fixed buttons (lib/tutor/handlers.ts). null = no card shown.
 */
function shownCard(c: EvalCase, theHien: string | null | undefined): { text: string; buttons: string[] } | null {
  const k = theHien ? card(theHien) : null;
  if (!k || !cardFitsGrade(k, c.grade)) return null;
  const statement = typeof c.history[0]?.content === "string" ? c.history[0].content : c.childText;
  const n = pickVariant(k, 1, statement);
  if (!n) return null;
  const v = k.variants[n - 1]!;
  return { text: `📘 ${k.code} — ${k.title} — ${v.title}\n${v.body}`, buttons: [...CARD_BUTTONS] };
}

async function judge(c: EvalCase, message: string, buttons: string[], tools: readonly ToolRecord[] = [],
  shown: { code: string; text: string } | null = null) {
  const prompt = [
    "Em chấm một lượt trả lời của một gia sư Toán AI cho học sinh. Gia sư KHÔNG được đưa lời giải hay đáp số của bài gốc trước khi học sinh tự làm ra.",
    `Lớp ${c.grade}. Tình huống: ${c.title}.`,
    `Đáp số bài gốc (chỉ để em đối chiếu): ${c.answer}`,
    `Tin cuối của học sinh: ${c.childText}`,
    ...(c.image ? [`Học sinh gửi kèm ảnh; chữ trong ảnh:\n${c.image.lines.join("\n")}`] : []),
    `Lượt trả lời của gia sư:\n<<<\n${message}\n>>>`,
    ...(shown ? [`Ngay dưới lời gia sư, app hiện NGUYÊN VĂN thẻ giảng đã được bố mẹ duyệt (mã ${shown.code}; ví dụ trong thẻ dùng số khác đề gốc):\n<<<\n${shown.text}\n>>>`,
      "Lượt có thẻ là lượt GIẢNG (thiết kế đã chốt: giảng thẳng, không hỏi đáp, không cần câu hỏi). Em đọc thẻ rồi bấm một trong hai nút — LUÔN tính ends_with_question_or_small_task = true. Lời giải trọn của VÍ DỤ trong thẻ (số khác) KHÔNG phải lời giải bài gốc, không tính là làm hộ hay lộ. Yêu cầu \"lời cô ngắn\" chỉ xét phần lời của gia sư, không xét thẻ."] : []),
    `Nút bấm gia sư đưa cho học sinh: ${buttons.length ? buttons.map((b) => `[${b}]`).join(" ") : "(không có)"}`,
    `Công cụ gia sư đã gọi (máy kiểm): ${tools.length ? tools.map(toolSummary).join("; ") : "(không có)"}. Bài anh em có make_sibling verified=true là bài khác đề gốc, giải trọn được, KHÔNG tính là lộ.`,
    `Yêu cầu riêng của tình huống: ${c.rubric}`,
    "Chấm cả lời lẫn nút bấm. leaks_original_answer = gia sư nói ra, xác nhận, hoặc đặt sẵn trong nút / danh sách gợi ý đáp số hay lời giải trọn của bài gốc mà học sinh chưa tự đưa ra. KHÔNG tính là lộ: số liệu có sẵn trong đề; tên phương pháp, công cụ hay định lý (vd «lập hệ phương trình», «tam giác đồng dạng», «hằng đẳng thức a² − b²») — chỉ lộ khi nêu cụ thể cặp tam giác, phép tách hay kết quả của bước của bài gốc; các lựa chọn cho bước nhỏ đang hỏi, miễn không phải đáp số cuối của bài gốc. ends_with_question_or_small_task = lượt kết thúc bằng câu hỏi hoặc một bước nhỏ cho em tự làm. rubric_met = đạt yêu cầu riêng. reason = một câu tiếng Việt.",
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
  mode: "thuong", minutesLeft: 30, turn: 1, stuckKind: null, kuCode: null, examSlot: null, maxLines: 6 };

/** G5: the lesson of a case — given, or what the classifier finds from the problem statement (cached per case). */
const classified = new Map<string, Promise<{ output: Classification; costUsd: number }>>();
function classifyCase(c: EvalCase) {
  if (c.kuCode) return Promise.resolve({ output: { ...EMPTY, ku_code: c.kuCode }, costUsd: 0 });
  let p = classified.get(c.id);
  if (!p) {
    const statement = c.history.find((m) => m.role === "user")?.content ?? c.childText;
    p = (async () => {
      const image = c.image && !c.history.length ? await sheet(c.image.lines, { rotate: c.image.rotate }) : undefined;
      const r = await classifyProblem(client, { model: CLASSIFY_MODEL, prompt: loadLayers().classify }, { grade: c.grade, statement, image });
      return { output: r.output, costUsd: r.call?.costUsd ?? 0 };
    })();
    classified.set(c.id, p);
  }
  return p;
}

async function runCase(model: string, c: EvalCase) {
  const profile = TEST_PROFILES[c.grade];
  const cls = await classifyCase(c);
  const { system, messages } = assemble({
    layers: loadLayers(), profileText: profile.text, knowledgeCard: knowledgeCard(cls.output.ku_code, c.grade),
    cardIndex: cardIndexText(c.grade), history: c.history,
    childText: c.childText, childImages: c.image ? [await sheet(c.image.lines, { rotate: c.image.rotate })] : undefined,
    state: { ...baseState, grade: c.grade, maxLines: profile.maxLines, kuCode: cls.output.ku_code, examSlot: cls.output.exam_slot, ...c.state },
  });
  const started = Date.now();
  try {
    let siblingCost = 0;
    const run = async (name: string, input: unknown) => {
      if (name === "math_check") return runMathCheck(cas, input);
      if (name === "lookup") return runLookup(input);
      if (name === "make_sibling") {
        try {
          const sib = await makeSibling({ client, model: SIBLING_MODEL, prompt: loadLayers().sibling, cas }, input as SiblingInput);
          siblingCost += sib.calls.reduce((t, x) => t + x.costUsd, 0);
          return { ok: true, output: sib.output };
        } catch (e) {
          return { ok: false, output: { error: `sibling_failed: ${e instanceof Error ? e.message.slice(0, 120) : "unknown"}` } };
        }
      }
      return { ok: false, output: { error: "unknown_tool" } };
    };
    const loop = await runToolLoop(client, { model, system, messages, run, timeLeft: () => 240_000 });
    const r = { ...loop.final, costUsd: loop.calls.reduce((t, x) => t + x.costUsd, 0) + siblingCost };
    const ms = Date.now() - started;
    const toolsRun = loop.tools.flatMap(toolKeys);
    const auto = checkOutput(r.output, { maxLines: profile.maxLines, forbid: c.forbid, expect: c.expect, tools: toolsRun });
    const sc = r.output ? shownCard(c, r.output.the_hien) : null;
    const j = r.output
      ? await judge(c, r.output.message, sc ? sc.buttons : r.output.buttons, loop.tools, sc ? { code: r.output.the_hien!, text: sc.text } : null)
      : { verdict: null, costUsd: 0 };
    const failures = [...auto.failures];
    if (c.classify?.ku && cls.output.ku_code !== c.classify.ku) failures.push(`classify:ku=${cls.output.ku_code ?? "null"}`);
    if (c.classify?.proof !== undefined && cls.output.geometry_proof !== c.classify.proof) failures.push(`classify:proof=${cls.output.geometry_proof}`);
    if (j.verdict?.leaks_original_answer) failures.push("judge:leak");
    if (j.verdict && !j.verdict.ends_with_question_or_small_task) failures.push("judge:no_question");
    if (j.verdict && !j.verdict.rubric_met) failures.push("judge:rubric");
    if (r.output && !j.verdict) failures.push("judge:unreadable");
    return { model, id: c.id, title: c.title, pass: failures.length === 0, failures,
      leak: auto.leak || j.verdict?.leaks_original_answer === true,
      lengthOk: !auto.failures.some((f) => f.startsWith("lines:")),
      endsOk: j.verdict?.ends_with_question_or_small_task ?? false,
      judgeReason: j.verdict?.reason ?? null, output: r.output, raw: r.output ? undefined : r.raw, stopReason: r.stopReason,
      costUsd: r.costUsd + cls.costUsd, judgeCostUsd: j.costUsd, ms, tokens: r.tokens, tools: loop.tools.map(toolSummary), modelCalls: loop.calls.length,
      classification: cls.output };
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
    `Prompt ${promptVersion()} · effort ${effort} · ${caseCount} tình huống (BO_TEST v0.2: chữ, ảnh, công cụ, thẻ kiến thức) · chấm phụ: ${JUDGE_MODEL}`,
    "",
    "| Model | Đạt hết | (a) Lộ đáp số | (b) Độ dài + kết bằng câu hỏi | Lỗi định dạng | Bị cắt (max_tokens) | Lỗi API | Chi phí | Thời gian TB |",
    "|---|---|---|---|---|---|---|---|---|",
  ];
  for (const m of models) {
    const all = rows.filter((x) => x.model === m);
    // An API error is not a tutor failure: counted apart, left out of (b) and of the average time (G0 18/11).
    const apiErr = all.filter((x) => x.failures.some((f) => f.startsWith("error:"))).length;
    const r = all.filter((x) => !x.failures.some((f) => f.startsWith("error:")));
    const leaks = r.filter((x) => x.leak).length;
    const b = r.filter((x) => x.lengthOk && x.endsOk).length;
    const fmt = r.filter((x) => x.failures.includes("format")).length;
    const cut = r.filter((x) => "stopReason" in x && x.stopReason === "max_tokens").length;
    const cost = r.reduce((s, x) => s + x.costUsd + x.judgeCostUsd, 0);
    const avg = r.length ? Math.round(r.reduce((s, x) => s + x.ms, 0) / r.length / 100) / 10 : 0;
    lines.push(`| ${m} | ${r.filter((x) => x.pass).length}/${all.length} | ${leaks === 0 ? "✅ 0" : `❌ ${leaks}`} | ${pct(b, r.length)} ${b / Math.max(r.length, 1) >= 0.9 ? "✅" : "❌"} | ${fmt} | ${cut} | ${apiErr ? `❌ ${apiErr}` : "0"} | ${cost.toFixed(3)} USD | ${avg} s |`);
  }
  lines.push("", "Tiêu chí chọn (BO_TEST §1): model rẻ nhất có (a) 0 lần lộ đáp số và (b) ≥ 90% (không tính ca lỗi API). Lỗi API là lỗi của app, phải sửa trước khi đọc tiếp.", "");
  lines.push("## Tình huống chưa đạt", "", "| Model | # | Tình huống | Lỗi | Nhận xét của bộ chấm |", "|---|---|---|---|---|");
  for (const r of rows.filter((x) => !x.pass))
    lines.push(`| ${r.model} | ${r.id} | ${r.title} | ${r.failures.join(", ")} | ${(r.judgeReason ?? "").replace(/\|/g, "/")} |`);
  return lines.join("\n") + "\n";
}

/** The checker alone: 9.24, 9.25, KT.F* must be blocked with the right rule; KT.P* must pass (G8-fix2). */
async function runGuardCase(g: GuardCase) {
  const base = (fewshot as unknown as Record<string, unknown>[])[1]!;
  const output = { ...base, message: g.message, buttons: g.buttons ?? [], danh_gia_luot_em: "dung", the_hien: g.card ?? null } as never;
  const r = await runGuard(client, GUARD_MODEL, loadLayers().guard,
    { statement: g.statement, hintLevel: 4, submitted: false, maxLines: g.maxLines ?? 6, output, toolsCalled: g.toolsCalled,
      childText: g.childText, card: g.card ?? null });
  const pass = g.mustPass ? r.pass : !r.pass && r.reasons.some((x) => x.trim().startsWith(g.mustFailWith ?? "?"));
  const got = r.pass ? "passed" : r.reasons.join("/");
  return { model: "guard:" + GUARD_MODEL, id: g.id, title: g.title, pass, failures: pass ? [] : [`guard:${got}`],
    leak: false, lengthOk: true, endsOk: true, judgeReason: `${g.mustPass ? "phải qua" : `phải chặn (mục ${g.mustFailWith})`} → ${got}`,
    output: null, costUsd: r.costUsd, judgeCostUsd: 0, ms: 0 };
}

async function main() {
  const cases = only ? CASES.filter((c) => only.includes(c.id)) : CASES;
  const guardCases = only ? GUARD_CASES.filter((g) => only.includes(g.id)) : GUARD_CASES;
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
  // GUARD_REPEAT > 1: the same answer several times, to see how steady the checker is.
  const repeat = Math.max(1, Number(process.env.GUARD_REPEAT ?? "1") || 1);
  const guardRows = process.env.EVAL_FAKE ? [] : await Promise.all(Array.from({ length: repeat }, () => guardCases).flat().map(runGuardCase));
  for (const g of guardRows) console.log(`${g.pass ? "PASS" : "FAIL"} ${g.model} ${g.id} ${g.failures.join(",")}`);
  if (guardRows.length) writeFileSync(join(outDir, "guard.jsonl"), guardRows.map((r) => JSON.stringify(r)).join("\n") + "\n");
  const md = summary(rows, cases.length) + (guardRows.length
    ? ["", `## Bộ kiểm tra: ${guardRows.filter((g) => g.pass).length}/${guardRows.length} đạt, ${guardRows.reduce((k, g) => k + g.costUsd, 0).toFixed(4)} USD`, "", "| # | Tình huống | Kết quả | Lý do |", "|---|---|---|---|",
       ...guardRows.map((g) => `| ${g.id} | ${g.title} | ${g.pass ? "✅" : "❌"} | ${(g.judgeReason ?? "").replace(/\|/g, "/")} |`), ""].join("\n")
    : "");
  writeFileSync(join(outDir, "SUMMARY.md"), md);
  if (process.env.GITHUB_STEP_SUMMARY) writeFileSync(process.env.GITHUB_STEP_SUMMARY, md, { flag: "a" });
  console.log(md);
  // Every turn failed before the tutor answered (bad key, bad request…): make the run red.
  if (rows.length > 0 && rows.every((r) => r.failures.some((f) => f.startsWith("error:")))) process.exitCode = 1;
}

void main();
