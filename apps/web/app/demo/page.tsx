import type { Metadata } from "next";
import { Demo } from "@/components/demo";
export const metadata: Metadata = {
  title: "Example report",
  description:
    "Explore a saved support-assistant example. See which rule removals the tests detected, find gaps, and review suggested tests.",
};
export default function DemoPage() {
  return <Demo />;
}
