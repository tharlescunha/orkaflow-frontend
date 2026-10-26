import type { ReactNode } from "react";

// Markdown mínimo das explicações da API: parágrafos, listas, **negrito**, `código` e blocos ```.
// Monta elementos React (sem innerHTML), então o texto nunca vira HTML.

function inline(text: string, keyPrefix: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter(Boolean);
  return parts.map((part, i) => {
    const key = `${keyPrefix}-${i}`;
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={key} className="font-semibold text-slate-900">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code key={key} className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[0.85em] text-slate-800">
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}

export function SimpleMarkdown({ text }: { text: string }) {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      i++;
      continue;
    }

    if (trimmed.startsWith("```")) {
      const code: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) code.push(lines[i++]);
      i++;
      blocks.push(
        <pre key={blocks.length} className="overflow-x-auto bg-slate-950 p-3 font-mono text-xs leading-relaxed text-slate-100">
          {code.join("\n")}
        </pre>
      );
      continue;
    }

    const bullet = /^[-*]\s+/;
    const numbered = /^\d+[.)]\s+/;
    if (bullet.test(trimmed) || numbered.test(trimmed)) {
      const ordered = numbered.test(trimmed);
      const pattern = ordered ? numbered : bullet;
      const items: string[] = [];
      while (i < lines.length && pattern.test(lines[i].trim())) items.push(lines[i++].trim().replace(pattern, ""));
      const Tag = ordered ? "ol" : "ul";
      blocks.push(
        <Tag key={blocks.length} className={`space-y-1 pl-5 ${ordered ? "list-decimal" : "list-disc"}`}>
          {items.map((item, j) => (
            <li key={j}>{inline(item, `${blocks.length}-${j}`)}</li>
          ))}
        </Tag>
      );
      continue;
    }

    if (trimmed.startsWith("#")) {
      blocks.push(
        <p key={blocks.length} className="font-semibold text-slate-900">
          {inline(trimmed.replace(/^#+\s*/, ""), String(blocks.length))}
        </p>
      );
      i++;
      continue;
    }

    const paragraph: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !lines[i].trim().startsWith("```") &&
      !bullet.test(lines[i].trim()) &&
      !numbered.test(lines[i].trim())
    ) {
      paragraph.push(lines[i++].trim());
    }
    blocks.push(<p key={blocks.length}>{inline(paragraph.join(" "), String(blocks.length))}</p>);
  }

  return <div className="space-y-2 text-sm leading-relaxed text-slate-700">{blocks}</div>;
}
