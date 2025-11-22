import { ReactElement } from "react";
import { NativeAdCard } from "@/components/NativeAdCard";
import React from "react";

export interface AdInsertionConfig {
  /** 每 N 個主題插入 1 個廣告 */
  interval?: number;
  /** 首屏不顯示廣告的主題數量 */
  skipFirst?: number;
  /** AdMob 原生廣告單元 ID */
  adUnitId?: string;
  /** 廣告索引計數器（用於動態加載） */
  adIndex?: number;
  /** 是否啟用廣告插入 */
  enabled?: boolean;
}

/**
 * 在主題列表中插入原生廣告
 * @param items 主題項目列表
 * @param renderItem 渲染主題項目的函數
 * @param config 廣告插入配置
 * @returns 包含廣告的主題列表
 */
export function insertAdsIntoList<T>(
  items: T[],
  renderItem: (item: T, index: number) => ReactElement,
  config: AdInsertionConfig = {}
): ReactElement[] {
  const {
    interval = 10,
    skipFirst = 10,
    adUnitId,
    adIndex = 0,
    enabled = true
  } = config;

  const result: ReactElement[] = [];
  let adCounter = adIndex;

  // 如果廣告功能未啟用，直接返回主題列表
  if (!enabled) {
    return items.map((item, index) => renderItem(item, index));
  }

  // 調試信息
  if (process.env.NODE_ENV === 'development') {
    console.log('insertAdsIntoList 配置:', {
      enabled,
      interval,
      skipFirst,
      adUnitId,
      itemsCount: items.length,
    });
  }

  items.forEach((item, index) => {
    // 渲染主題項目
    result.push(renderItem(item, index));

    // 檢查是否需要插入廣告
    // 1. 必須在首屏之後（index >= skipFirst）
    // 2. 每 interval 個主題插入一個廣告（從首屏之後開始計算）
    // 3. 不是最後一個項目
    // 4. 必須有 adUnitId
    const positionAfterSkip = index + 1 - skipFirst; // 從首屏之後的位置（從 1 開始）
    
    const shouldInsertAd = 
      enabled &&
      adUnitId &&
      index + 1 > skipFirst && // 必須在首屏之後
      positionAfterSkip > 0 &&
      positionAfterSkip % interval === 0 && // 每 interval 個主題插入一個廣告
      index < items.length - 1; // 不是最後一個項目

    if (shouldInsertAd) {
      if (process.env.NODE_ENV === 'development') {
        console.log(`插入廣告在位置 ${index + 1} (index ${index}), positionAfterSkip: ${positionAfterSkip}`);
      }
      result.push(
        <NativeAdCard
          key={`ad-${adCounter}`}
          adUnitId={adUnitId}
          className="mt-4"
        />
      );
      adCounter++;
    }
  });

  return result;
}

