import type { Metadata } from "next";

import { HowItWorks } from "@/components/marketing/how-it-works";

export const metadata: Metadata = {
  title: "How it works",
  description: "How Covenant locks an FXRP bond behind an XRP payment.",
};

export default function HowItWorksPage() {
  return (
    <HowItWorks />
  );
}
