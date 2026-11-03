"use client";
import { Md } from "./ui";
import { File, Mic } from "./icons";

export interface AnswerSource { kind: "talk" | "deck"; sessionId?: string; sessionTitle?: string; t?: string; quote?: string; documentId?: string; documentName?: string; page?: number; title?: string; excerpt?: string }
interface Section { kind: "talk" | "deck" | "plain"; label: string; text: string }

/** Splits an answer into its talk / deck sections (markers are language-agnostic, labels are the model's). */
export function sections(text: string): Section[] {
  const out: Section[] = [];
  const re = /<<(TALK|DECK)\|([^>\n]*)>>/g;
  let last = 0, m: RegExpExecArray | null, cur: Section | null = null;
  while ((m = re.exec(text))) {
    const before = text.slice(last, m.index).trim();
    if (cur) cur.text = before; else if (before) out.push({ kind: "plain", label: "", text: before });
    cur = { kind: m[1] === "TALK" ? "talk" : "deck", label: m[2].trim(), text: "" };
    out.push(cur);
    last = m.index + m[0].length;
  }
  const tail = text.slice(last).replace(/<<(TALK|DECK)?\|?[^>]*$/, "").trim(); // drop a half-streamed marker
  if (cur) cur.text = tail; else if (tail) out.push({ kind: "plain", label: "", text: tail });
  return out.filter((s) => s.kind !== "plain" || s.text);
}

/** Renders an answer as a "from the talk" card with timestamp citations and a "from the deck" card with slide citations. */
export function AnswerBlocks({ text, sources, compact }: { text: string; sources: AnswerSource[]; compact?: boolean }) {
  const secs = sections(text);
  const talkSrc = sources.filter((s) => s.kind === "talk");
  const deckSrc = sources.filter((s) => s.kind === "deck");
  if (!secs.some((s) => s.kind !== "plain")) {
    return <div className="col" style={{ gap: 10 }}><Md text={text} /><Cites talk={talkSrc} deck={deckSrc} /></div>;
  }
  return (
    <div className={`col ${compact ? "ans-compact" : ""}`} style={{ gap: compact ? 8 : 12 }}>
      {secs.map((s, i) => s.kind === "plain" ? <Md key={i} text={s.text} /> : (
        <section key={i} className={`ans ans-${s.kind}`}>
          <div className="ans-hd">{s.kind === "talk" ? <Mic size={15} /> : <File size={15} />}<span>{s.label || (s.kind === "talk" ? "From the talk" : "From the deck")}</span></div>
          <Md text={s.text} className="answer ans-body" />
          {s.kind === "talk" && talkSrc.length > 0 && <div className="cites">{talkSrc.map((c, j) => <span key={j} className="cite" title={c.quote}>{c.t ? `[${c.t}]` : "said"}{c.sessionTitle ? ` · ${c.sessionTitle}` : ""}</span>)}</div>}
          {s.kind === "deck" && deckSrc.length > 0 && <div className="cites">{deckSrc.map((c, j) => c.documentId ? <a key={j} className="cite" href={`/api/documents/${c.documentId}/file#page=${c.page || 1}`} target="_blank" rel="noreferrer" title={c.excerpt}>Slide {c.page ?? "?"}{c.title ? ` · ${c.title}` : ""}</a> : <span key={j} className="cite">Slide {c.page ?? "?"}</span>)}</div>}
        </section>
      ))}
    </div>
  );
}

function Cites({ talk, deck }: { talk: AnswerSource[]; deck: AnswerSource[] }) {
  if (!talk.length && !deck.length) return null;
  return <div className="cites">{talk.map((c, j) => <span key={`t${j}`} className="cite" title={c.quote}>{c.t ? `[${c.t}]` : "said"}{c.sessionTitle ? ` · ${c.sessionTitle}` : ""}</span>)}{deck.map((c, j) => <span key={`d${j}`} className="cite" title={c.excerpt}>Slide {c.page ?? "?"}</span>)}</div>;
}
