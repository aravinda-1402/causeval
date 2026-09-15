"use client";
import { Check, Copy } from "lucide-react";
import { useEffect, useRef, useState } from "react";
function useCopy() {
  const [status, setStatus] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => void (timer.current && clearTimeout(timer.current)),
    [],
  );
  return {
    status,
    copy: async (text: string) => {
      try {
        await navigator.clipboard.writeText(text);
        setStatus("Copied");
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => setStatus(""), 2000);
      } catch {
        setStatus("Select and copy the command below.");
      }
    },
  };
}
export function CopyCommand({
  text = "pnpm causeval demo",
  compact = false,
}: {
  text?: string;
  compact?: boolean;
}) {
  const { status, copy } = useCopy();
  return (
    <button
      className={"copy-command " + (compact ? "compact" : "")}
      onClick={() => copy(text)}
      aria-label="Copy command"
    >
      <span className="prompt-dollar">$</span>
      <code>{text}</code>
      {status === "Copied" ? <Check size={15} /> : <Copy size={15} />}
      <span className="sr-only" role="status">
        {status}
      </span>
    </button>
  );
}
export function CopyBlock({
  title,
  lines,
}: {
  title: string;
  lines: readonly string[];
}) {
  const { status, copy } = useCopy();
  return (
    <div className="copy-block">
      <div className="copy-block-top">
        <span>{title}</span>
        <button
          onClick={() => copy(lines.join("\n"))}
          aria-label="Copy all commands"
        >
          {status === "Copied" ? <Check size={14} /> : <Copy size={14} />}
          {status === "Copied" ? "Copied" : "Copy"}
        </button>
      </div>
      <pre>
        <code>
          {lines.map((line) => (
            <span key={line} className="copy-block-line">
              <span className="prompt-dollar">$</span> {line}
            </span>
          ))}
        </code>
      </pre>
      <span className="sr-only" role="status">
        {status}
      </span>
    </div>
  );
}
