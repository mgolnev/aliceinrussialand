import { parseRichText, type RichTextPart } from "@/lib/rich-text";

function RichTextParts({ parts }: { parts: RichTextPart[] }) {
  return parts.map((part, index) => {
    const key = `${part.type}-${index}`;
    if (part.type === "text") return part.value;
    if (part.type === "strong") {
      return <strong key={key}><RichTextParts parts={part.children} /></strong>;
    }
    if (part.type === "em") {
      return <em key={key}><RichTextParts parts={part.children} /></em>;
    }
    if (part.type === "strike") {
      return <s key={key}><RichTextParts parts={part.children} /></s>;
    }
    return (
      <a
        key={key}
        href={part.href}
        target="_blank"
        rel="noreferrer"
        className="pointer-events-auto text-blue-600 underline decoration-blue-400 underline-offset-2 transition hover:text-blue-800 hover:decoration-blue-700"
      >
        <RichTextParts parts={part.children} />
      </a>
    );
  });
}

export function PostRichText({ value }: { value: string }) {
  return <RichTextParts parts={parseRichText(value)} />;
}
