/** Hint ladder H0–H5 (DOMAIN §3.3, §4.1). The server owns the level; the model only gives a verdict. */

export type HintLevel = 0 | 1 | 2 | 3 | 4 | 5;
export type Verdict = "dung" | "sai" | "khong_biet" | "xin_dap_an" | "ngoai_le" | "khong_ap_dung";

export interface HintState {
  hintLevel: HintLevel;
  hintLevelMax: HintLevel;
  nanJumps: number;
  /** True after the tutor solved the sibling problem at H4; the child is retrying the original. */
  afterSibling: boolean;
}

const clamp = (n: number): HintLevel => Math.max(0, Math.min(5, n)) as HintLevel;

function withLevel(s: HintState, level: HintLevel): HintState {
  return { ...s, hintLevel: level, hintLevelMax: clamp(Math.max(s.hintLevelMax, level)) };
}

/** Before calling the model: nản jumps straight to H4 when the level is ≤ H3 (D10, D17: no limit). */
export function applyPreTurn(s: HintState, signals: { nan: boolean }): { state: HintState; jumped: boolean } {
  if (signals.nan && s.hintLevel <= 3) {
    return { state: { ...withLevel(s, 4), nanJumps: s.nanJumps + 1 }, jumped: true };
  }
  return { state: s, jumped: false };
}

/** After the model: apply its verdict on the child's last turn. Levels only go up inside a problem. */
export function nextHintLevel(s: HintState, verdict: Verdict): HintState {
  if (s.hintLevel === 4 && s.afterSibling && (verdict === "sai" || verdict === "khong_biet")) {
    return withLevel(s, 5);
  }
  if (verdict === "sai" || verdict === "khong_biet" || verdict === "xin_dap_an") {
    // H4 is reached only by nản or by climbing from H3; H5 only from H4 after the sibling (above).
    return s.hintLevel >= 4 ? s : withLevel(s, clamp(s.hintLevel + 1));
  }
  return s;
}
