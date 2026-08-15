/** Minimal ERC20 surface needed to read and approve the FXRP collateral token. */
export const erc20Abi = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
] as const;

/**
 * The Coston2 FTestXRP collateral token (see covenantCoston2Deployment.collateralToken)
 * uses 6 decimals, verified directly against its deployed decimals() and symbol() on
 * Coston2. XRP drops share the same 6-decimal precision, so the same formatter serves both.
 */
export const FXRP_DECIMALS = 6;
export const FXRP_SYMBOL = "FTestXRP";
export const XRP_DECIMALS = 6;
