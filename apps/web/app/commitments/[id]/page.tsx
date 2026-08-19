import { Suspense } from "react";

import {
  CommitmentDetail,
  DetailBodySkeleton,
} from "@/components/commitments/commitment-detail";

export default async function CommitmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-20">
      <h1 className="text-3xl font-bold tracking-tight text-ink sm:text-4xl">
        Commitment #{id}
      </h1>
      <Suspense fallback={<DetailBodySkeleton />}>
        <CommitmentDetail id={id} />
      </Suspense>
    </section>
  );
}
