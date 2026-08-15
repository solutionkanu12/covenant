import { createConfig, http } from "wagmi";
// Import connectors from their granular paths: the wagmi/connectors barrel
// also loads the tempo connector, whose optional peer we do not install.
import { coinbaseWallet } from "wagmi/connectors/coinbaseWallet";
import { injected } from "wagmi/connectors/injected";

import { coston2 } from "./chains";

const rpcUrl = process.env.NEXT_PUBLIC_COSTON2_RPC_URL;

export const wagmiConfig = createConfig({
  chains: [coston2],
  connectors: [injected(), coinbaseWallet({ appName: "Covenant" })],
  transports: {
    [coston2.id]: http(rpcUrl && rpcUrl.length > 0 ? rpcUrl : undefined),
  },
  ssr: true,
});
