import { ConnectButton } from "@/components/wallet/connect-button";
import { ConnectRedirect } from "@/components/wallet/connect-redirect";
import { Deployment } from "@/components/marketing/deployment";
import { HowItWorks } from "@/components/marketing/how-it-works";

export default function Home() {
  return (
    <>
      <ConnectRedirect />
      <section className="relative h-svh min-h-svh overflow-hidden">
        {/* Background is painted, not in document flow. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "url('/vault-hero.jpg')" }}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 backdrop-blur-[6px]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-black/62"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[#ff5a45]/12"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/35"
        />
        <div className="relative z-10 flex h-full items-center justify-center px-4 sm:px-6">
          <div className="mx-auto w-full max-w-3xl py-24 text-center sm:py-28">
            <h1 className="text-[1.85rem] leading-[1.15] font-bold tracking-tight text-balance break-words text-ink sm:text-5xl md:text-[3.5rem] md:leading-[1.08]">
              Lock a bond behind an XRP payment
            </h1>
            <p className="mx-auto mt-5 max-w-xl px-1 text-base leading-7 text-pretty text-ink-soft sm:mt-6 sm:text-lg sm:leading-8">
              Covenant locks a small FXRP bond on Flare. The XRP itself moves
              only on XRPL. A Flare proof returns the bond when you pay, or
              sends it to the recipient if you do not.
            </p>
            <div className="mx-auto mt-8 flex w-full max-w-sm flex-col items-stretch gap-3 sm:mt-9 sm:max-w-none sm:flex-row sm:items-center sm:justify-center">
              <ConnectButton size="md" className="w-full sm:w-auto" />
            </div>
          </div>
        </div>
      </section>

      <HowItWorks />
      <Deployment />
    </>
  );
}
