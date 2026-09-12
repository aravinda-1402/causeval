import Link from "next/link";
export function Brand() {
  return (
    <Link href="/" className="brand" aria-label="CausEval home">
      <svg
        width="29"
        height="29"
        viewBox="0 0 32 32"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M23.5 7.5a12 12 0 1 0 0 17"
          stroke="currentColor"
          strokeWidth="3.5"
          strokeLinecap="round"
        />
        <path
          d="m17 10 6 6-6 6"
          stroke="var(--accent)"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M10 16h12"
          stroke="var(--accent)"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </svg>
      <span>CausEval</span>
    </Link>
  );
}
