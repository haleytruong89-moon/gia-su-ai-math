// lib/tools/defs.ts — the tools the tutor model may call (SYSTEM_PROMPT "Công cụ"; DESIGN §5).
// No minimum/maxLength keywords: the API refuses them (see lib/tutor/schema.ts apiSafeSchema).
export type ToolName = "math_check" | "make_sibling" | "lookup";

/** One tool call of a turn, as stored in tutor.tool_calls. `round` = index of the model call that asked. */
export interface ToolRecord { tool: ToolName; input: unknown; output: unknown; ok: boolean; ms: number; round: number }

export const MATH_MODES = [
  "equivalent", "simplify_check", "solve", "check_root", "evaluate", "inequality", "domain", "solve_system", "check_solution",
] as const;
export type MathMode = (typeof MATH_MODES)[number];

const str = { type: "string" };
const strList = { type: "array", items: str };

export const TOOL_DEFS = [
  {
    name: "math_check" as const,
    description:
      "Máy tính đại số (SymPy). Gọi TRƯỚC khi nói một phép tính, một đáp số hay một bước biến đổi là đúng hoặc sai. " +
      "Cú pháp: sqrt(x), x**2, phân số a/b, gcd(a, b), lcm(a, b, c). " +
      "equivalent: expr_a có bằng expr_b không. simplify_check: expr_a (của em) bằng expr_b (đề) và đã rút gọn hết chưa. " +
      "solve: giải equation 1 ẩn. check_root: value có là nghiệm của equation không. evaluate: tính expr_a (có thể thay value). " +
      "inequality: giải bất phương trình. domain: điều kiện xác định của expr_a. " +
      "solve_system: giải hệ equations theo variables. check_solution: values (vd {\"x\":\"24\",\"y\":\"48\"}) có thỏa mọi equations không. " +
      "Kết quả là để cô biết; KHÔNG chép đáp số vào message khi em chưa tự làm ra.",
    input_schema: {
      type: "object",
      properties: {
        mode: { type: "string", enum: [...MATH_MODES] },
        expr_a: str, expr_b: str, equation: str, equations: strList, value: str,
        values: { type: "object", additionalProperties: str }, inequality: str,
        variable: str, variables: strList, assumptions: strList, round_to: { type: "integer" },
      },
      required: ["mode"],
      additionalProperties: false,
    },
  },
  {
    name: "make_sibling" as const,
    description:
      "Chỉ dùng ở mức H4: tạo BÀI ANH EM cùng dạng, số khác đề gốc, có lời giải từng bước. Máy đã kiểm đáp số bài anh em. " +
      "Chỉ dùng kết quả khi verified = true và numbers_differ = true; ngược lại không đưa bài anh em, gắn cờ tutor_unsure.",
    input_schema: {
      type: "object",
      properties: {
        original_statement: str,
        ku_code: { type: ["string", "null"] },
        difficulty: { type: "string", enum: ["same", "easier"] },
      },
      required: ["original_statement", "difficulty"],
      additionalProperties: false,
    },
  },
  {
    name: "lookup" as const,
    description:
      "Tra thẻ kiến thức theo mã: bài SGK (T9.9, T6.12…), kiến thức nền (N8.02, TH.05…) hoặc một mục hộp công cụ (hinh.1.7, rutgon.3…). " +
      "Dùng khi em vướng kiến thức nền, khi cần cách làm theo mục tiêu, hoặc khi bài không khớp thẻ kiến thức đang có.",
    input_schema: { type: "object", properties: { code: str }, required: ["code"], additionalProperties: false },
  },
];
