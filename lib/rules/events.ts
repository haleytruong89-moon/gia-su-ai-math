// lib/rules/events.ts — the child's events of a problem, as the nản rule (lib/rules/nan.ts) reads them.
import { NOT_UNDERSTOOD, type ChildEvent } from "@/lib/rules/nan";

export type InputKind = "text" | "button" | "submit";
export interface StoredMsg { id: string; role: "child" | "tutor"; content: string; inputKind: InputKind }

/**
 * Oldest first. A "Chưa hiểu" press gets the root of its re-explanation chain as `replyTo`: the tutor
 * message it answers, unless that tutor message was itself answering a "Chưa hiểu" — then the same root
 * (DOMAIN §4.2: "cùng message_id gốc hoặc các lượt giảng lại của nó").
 */
export function childEvents(msgs: readonly StoredMsg[]): ChildEvent[] {
  const out: ChildEvent[] = [];
  const rootOfPress = new Map<string, string>();
  for (let i = 0; i < msgs.length; i++) {
    const m = msgs[i]!;
    if (m.role !== "child") continue;
    if (m.inputKind !== "button") {
      out.push({ kind: "text", text: m.content });
      continue;
    }
    let replyTo: string | undefined;
    if (m.content === NOT_UNDERSTOOD) {
      const tutor = msgs[i - 1]?.role === "tutor" ? msgs[i - 1] : undefined;
      const before = msgs[i - 2];
      const chained = before?.role === "child" && before.inputKind === "button" && before.content === NOT_UNDERSTOOD;
      replyTo = chained ? rootOfPress.get(before.id) : tutor?.id;
      if (replyTo) rootOfPress.set(m.id, replyTo);
    }
    out.push({ kind: "button", label: m.content, replyTo });
  }
  return out;
}
