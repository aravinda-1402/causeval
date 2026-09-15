import type { Metadata } from "next";
import "./globals.css";
const siteURL = process.env.NEXT_PUBLIC_SITE_URL;
const socialImage = siteURL
  ? new URL("/social-preview.png", siteURL).href
  : "https://raw.githubusercontent.com/aravinda-1402/causeval/main/apps/web/public/social-preview.png";
const description =
  "Map behavioral rules in LLM system prompts to evals and verify whether those tests detect controlled removal of the rules. Contract · Trace · Verify.";
export const metadata: Metadata = {
  ...(siteURL ? { metadataBase: new URL(siteURL) } : {}),
  title: {
    default: "CausEval — Behavioral Coverage for LLM Evals",
    template: "%s · CausEval",
  },
  description,
  openGraph: {
    type: "website",
    siteName: "CausEval",
    title: "CausEval — Code has coverage. Your prompts should too.",
    description,
    images: [
      {
        url: socialImage,
        width: 1200,
        height: 630,
        alt: "CausEval. Code has coverage. Your prompts should too. Contract · Trace · Verify.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "CausEval — Behavioral Coverage for LLM Evals",
    description,
    images: [socialImage],
  },
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
