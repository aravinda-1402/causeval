import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: {
    default: "CausEval — Code has coverage. Your prompts should too.",
    template: "%s · CausEval",
  },
  description:
    "Find the behavioral rules your AI eval suite does not actually protect. Explore Trace Coverage, Causal Rule Coverage, and pseudo-covered behaviors.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
