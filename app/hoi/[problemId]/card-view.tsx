// The approved teaching card under a tutor message, word for word (G6, DOMAIN §4.15). Text nodes only, never HTML.
import { cardBlocks, type CardRun } from "@/lib/cardBlocks";
import { CARD_MISSING } from "@/lib/copy";
import { cardText } from "@/lib/knowledge/cardText";

function Runs({ runs }: { runs: CardRun[] }) {
  return (
    <>
      {runs.map((r, i) => {
        const parts = r.text.split("\n");
        const t = parts.map((p, k) => (k ? [<br key={`b${k}`} />, p] : p));
        if (r.bold) return <b key={i}>{t}</b>;
        if (r.italic) return <i key={i}>{t}</i>;
        return <span key={i}>{t}</span>;
      })}
    </>
  );
}

export function CardView({ cardRef }: { cardRef: string }) {
  const c = cardText(cardRef);
  if (!c) return <p className="mt-2 rounded-xl bg-[#EEF3F0] px-4 py-3 text-base">{CARD_MISSING}</p>;
  const blocks = cardBlocks(c.body);
  return (
    <section aria-label={`Thẻ ${c.title}`} data-card={`${c.code}#${c.n}`}
      className="mt-2 rounded-2xl border-[1.5px] border-accent/30 bg-[#EEF3F0] px-4 py-3 text-base leading-relaxed">
      <h3 className="mb-2 font-semibold">📘 {c.title} — {c.wayTitle}</h3>
      <div className="flex flex-col gap-2">
        {blocks.map((b, i) => {
          if (b.t === "p") return <p key={i}><Runs runs={b.runs} /></p>;
          if (b.t === "ul") return <ul key={i} className="list-disc pl-5">{b.items.map((it, j) => <li key={j}><Runs runs={it} /></li>)}</ul>;
          return (
            <div key={i} className="overflow-x-auto">
              <table className="border-collapse text-base">
                <tbody>
                  {b.rows.map((row, j) => (
                    <tr key={j}>
                      {row.map((cell, k) => (
                        <td key={k} className={`border border-ink/15 px-2 py-1 ${j === 0 ? "font-semibold" : ""}`}><Runs runs={cell} /></td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })}
      </div>
      {c.body.includes("Ghi vào vở") && <p className="mt-2 text-sm text-ink/70">📝 Em chép phần <b>Ghi vào vở</b> nhé.</p>}
    </section>
  );
}
