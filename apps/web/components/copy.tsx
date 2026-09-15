"use client";
import { Check, Copy } from "lucide-react";
import { useState } from "react";
export function CopyCommand({
  text = "pnpm causeval demo",
  compact = false,
}: {
  text?: string;
  compact?: boolean;
}) {
  const [status, setStatus] = useState("");
  return (
    <button
      className={"copy-command " + (compact ? "compact" : "")}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setStatus("Copied");
          setTimeout(() => setStatus(""), 2000);
        } catch {
          setStatus("Select and copy the command below.");
        }
      }}
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
