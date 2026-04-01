import { ImpactStyle } from "@capacitor/haptics";
import { hapticImpact } from "@/lib/capacitor";

type TokenHapticDirection = "gain" | "spend";

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const resolveTier = (amount: number) => {
  if (amount <= 10) return 1;
  if (amount <= 50) return 2;
  return 3;
};

/**
 * 代幣數量震動反饋
 * 1-10：輕；11-50：中；51+：重且連擊
 */
export const playTokenAmountHaptic = async (
  amount: number,
  direction: TokenHapticDirection = "spend"
) => {
  const safeAmount = Math.max(0, Math.floor(Number(amount) || 0));
  if (safeAmount <= 0) return;

  const tier = resolveTier(safeAmount);

  // spend 預設更有「砸代幣」手感
  if (tier === 1) {
    await hapticImpact(direction === "spend" ? ImpactStyle.Medium : ImpactStyle.Light);
    return;
  }

  if (tier === 2) {
    await hapticImpact(ImpactStyle.Medium);
    await sleep(45);
    await hapticImpact(direction === "spend" ? ImpactStyle.Heavy : ImpactStyle.Medium);
    return;
  }

  await hapticImpact(ImpactStyle.Heavy);
  await sleep(50);
  await hapticImpact(ImpactStyle.Heavy);
  await sleep(60);
  await hapticImpact(direction === "spend" ? ImpactStyle.Heavy : ImpactStyle.Medium);
};

