import type { Metadata } from "next";

import { Deployment } from "@/components/marketing/deployment";

export const metadata: Metadata = {
  title: "Deployment",
  description: "Covenant Coston2 deployment details.",
};

export default function DeploymentPage() {
  return (
    <div className="pt-10">
      <Deployment />
    </div>
  );
}
