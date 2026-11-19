import type { ReactNode } from "react";
import { parseInline, type Article, type Callout, type Inline } from "./article-parse";

export { parseArticle, type Article } from "./article-parse";

function nodes(xs: Inline[]): ReactNode[] {
  return xs.map((x, i) => {
    switch (x.t) {
      case "text": return x.v;
      case "b": return <strong key={i}>{nodes(x.v)}</strong>;
      case "i": return <em key={i}>{x.v}</em>;
      case "kbd": return <kbd key={i}>{x.v}</kbd>;
      case "a": return <a key={i} className="lnk" href={x.href} target="_blank" rel="noopener noreferrer">{x.v}<span className="sr-only"> (abre em outra aba)</span></a>;
    }
  });
}
const inline = (s: string) => nodes(parseInline(s));
const LABEL: Record<Callout, string> = { dica: "Dica", atencao: "Atenção", importante: "Importante" };

export function ArticleBody({ a }: { a: Article }) {
  return (
    <>
      {a.blocks.map((b, i) => {
        switch (b.k) {
          case "h2": return <h2 key={i} id={b.id}>{inline(b.text)}</h2>;
          case "h3": return <h3 key={i}>{inline(b.text)}</h3>;
          case "p": return <p key={i}>{inline(b.text)}</p>;
          case "ul": return <ul key={i}>{b.items.map((t, j) => <li key={j}>{inline(t)}</li>)}</ul>;
          case "ol": return <ol key={i}>{b.items.map((t, j) => <li key={j}>{inline(t)}</li>)}</ol>;
          case "hr": return <hr key={i} />;
          case "callout":
            return (
              <aside key={i} className={`lart-call${b.kind ? ` is-${b.kind}` : ""}`}>
                {(b.kind || b.title) && <b className="lart-call-t">{b.kind ? LABEL[b.kind] : ""}{b.kind && b.title ? ": " : ""}{b.title && inline(b.title)}</b>}
                {b.lines.map((t, j) => <p key={j}>{inline(t)}</p>)}
              </aside>
            );
        }
      })}
    </>
  );
}
