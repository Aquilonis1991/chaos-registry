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

  // 只在首次調用或配置變化時輸出配置信息（避免重複日誌）
  const logKey = `ad-insertion-${enabled}-${interval}-${skipFirst}-${adUnitId ? 'SET' : 'MISSING'}`;
  if (!(window as any).__adInsertionConfigLogged || (window as any).__adInsertionConfigLogged !== logKey) {
    console.log(`[insertAdsIntoList] 配置: enabled=${enabled}, interval=${interval}, skipFirst=${skipFirst}, itemsCount=${items.length}`);
    (window as any).__adInsertionConfigLogged = logKey;
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
    
    // 調整邏輯：允許在最後一個項目之前插入（但不在最後一個項目之後）
    const shouldInsertAd = 
      enabled &&
      adUnitId &&
      index + 1 > skipFirst && // 必須在首屏之後
      positionAfterSkip > 0 &&
      positionAfterSkip % interval === 0 && // 每 interval 個主題插入一個廣告
      index < items.length - 1; // 不是最後一個項目（允許在倒數第 2 個之後插入）

    if (shouldInsertAd) {
      console.log(`[insertAdsIntoList] ✅ 插入廣告在位置 ${index + 1}, adKey=ad-${adCounter}`);
      const adElement = (
        <div 
          key={`ad-wrapper-${adCounter}`} 
          className="w-full" 
          style={{ 
            display: 'block', 
            visibility: 'visible',
            opacity: 1,
            minHeight: '200px'
          }}
        >
          <NativeAdCard
            key={`ad-${adCounter}`}
            adUnitId={adUnitId}
            className="mt-4"
            onAdLoaded={() => {
              console.log(`[insertAdsIntoList] 廣告已載入: ad-${adCounter}`);
            }}
          />
        </div>
      );
      result.push(adElement);
      adCounter++;
    }
  });

  return result;
}

