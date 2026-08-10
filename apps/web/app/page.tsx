import { productName } from "@covenant/shared";

export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-slate-100">
      <section className="max-w-xl text-center">
        <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-sky-400">
          Phase 0
        </p>
        <h1 className="text-5xl font-bold tracking-tight">{productName}</h1>
        <p className="mt-5 text-lg leading-8 text-slate-300">
          The local development foundation is ready.
        </p>
      </section>
    </main>
  );
}
