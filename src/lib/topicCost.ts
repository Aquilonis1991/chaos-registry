export interface TopicCostConfig {
  exposureCosts: Record<string, number>;
  durationCosts: Record<string, number>;
  baseCost?: number;
  dailyDiscountAmount?: number;
}

export interface TopicCostParams extends TopicCostConfig {
  exposureLevel: string;
  durationDays: number;
  dailyDiscountAmount?: number;
  hasFreeQualification?: boolean;
}

export interface TopicCostResult {
  baseCost: number;
  exposureCost: number;
  durationCost: number;
  totalBeforeDiscount: number;
  discountApplied: number;
  totalCost: number;
  isFullyFree: boolean;
}

const DEFAULT_EXPOSURE_COSTS: Record<string, number> = {
  normal: 30,
  medium: 90,
  high: 180
};

const DEFAULT_DURATION_COSTS: Record<string, number> = {
  "1": 0, "2": 0, "3": 0, "4": 1, "5": 2, "6": 3, "7": 4,
  "8": 6, "9": 8, "10": 10, "11": 12, "12": 14, "13": 16,
  "14": 18, "15": 21, "16": 24, "17": 27, "18": 30,
  "19": 30, "20": 30, "21": 30, "22": 30, "23": 30,
  "24": 30, "25": 30, "26": 30, "27": 30, "28": 30,
  "29": 30, "30": 30
};

export const withDefaultExposureCosts = (costs?: Record<string, number>) => {
  if (!costs || typeof costs !== "object") return DEFAULT_EXPOSURE_COSTS;
  return { ...DEFAULT_EXPOSURE_COSTS, ...costs };
};

export const withDefaultDurationCosts = (costs?: Record<string, number>) => {
  if (!costs || typeof costs !== "object") return DEFAULT_DURATION_COSTS;
  return { ...DEFAULT_DURATION_COSTS, ...costs };
};

export const calculateTopicCost = (params: TopicCostParams): TopicCostResult => {
  const exposureCosts = withDefaultExposureCosts(params.exposureCosts);
  const durationCosts = withDefaultDurationCosts(params.durationCosts);
  const baseCost = Number(params.baseCost ?? 0) || 0;
  const exposureCost = Number(exposureCosts[params.exposureLevel as keyof typeof exposureCosts] ?? exposureCosts.normal ?? 0) || 0;
  const durationCost = Number(durationCosts[params.durationDays.toString()] ?? 0) || 0;

  const totalBeforeDiscount = baseCost + exposureCost + durationCost;
  const isFullyFree = Boolean(params.hasFreeQualification);

  let discountApplied = 0;
  if (!isFullyFree) {
    const discount = Number(params.dailyDiscountAmount ?? 0);
    if (discount > 0 && totalBeforeDiscount > 0) {
      discountApplied = Math.min(discount, totalBeforeDiscount);
    }
  }

  const totalCost = isFullyFree ? 0 : Math.max(0, totalBeforeDiscount - discountApplied);

  return {
    baseCost,
    exposureCost,
    durationCost,
    totalBeforeDiscount,
    discountApplied,
    totalCost,
    isFullyFree
  };
};

