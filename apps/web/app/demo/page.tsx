import type { Metadata } from "next";
import { Demo } from "@/components/demo";
export const metadata: Metadata = {
  title: "Interactive coverage demo",
  description:
    "Inspect a real deterministic analysis: 10 rules, 70% Trace Coverage, 40% Causal Rule Coverage. Explore the evidence behind pseudo-covered rules.",
};
export default function DemoPage() {
  return <Demo />;
}
