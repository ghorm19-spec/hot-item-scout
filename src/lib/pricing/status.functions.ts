import { createServerFn } from "@tanstack/react-start";

export interface ProviderStatus {
  ebay: { connected: boolean; envVar: string };
  stockx: { connected: boolean; envVar: string };
  pricecharting: { connected: boolean; envVar: string };
}

export const getPricingProviderStatus = createServerFn({ method: "GET" })
  .handler(async (): Promise<ProviderStatus> => {
    const has = (k: string) => !!(process.env[k] && String(process.env[k]).trim());
    return {
      ebay:          { connected: has("EBAY_API_KEY"),       envVar: "EBAY_API_KEY" },
      stockx:        { connected: has("STOCKX_API_KEY"),     envVar: "STOCKX_API_KEY" },
      pricecharting: { connected: has("PRICECHARTING_KEY"),  envVar: "PRICECHARTING_KEY" },
    };
  });