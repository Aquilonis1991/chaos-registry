import { ReactNode, useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { cn } from '@/lib/utils';

interface SafeAreaProps {
  children: ReactNode;
  top?: boolean;
  bottom?: boolean;
  left?: boolean;
  right?: boolean;
  className?: string;
}

/**
 * SafeArea 組件 - 處理原生 APP 的安全區域
 * 在 iOS 上會自動添加頂部和底部的安全區域內距
 */
export const SafeArea = ({ 
  children, 
  top = true, 
  bottom = true, 
  left = true, 
  right = true,
  className 
}: SafeAreaProps) => {
  const [safeAreaInsets, setSafeAreaInsets] = useState({
    top: 0,
    bottom: 0,
    left: 0,
    right: 0
  });

  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      // 獲取安全區域
      const computedStyle = getComputedStyle(document.documentElement);
      
      setSafeAreaInsets({
        top: parseInt(computedStyle.getPropertyValue('--sat') || '0'),
        bottom: parseInt(computedStyle.getPropertyValue('--sab') || '0'),
        left: parseInt(computedStyle.getPropertyValue('--sal') || '0'),
        right: parseInt(computedStyle.getPropertyValue('--sar') || '0'),
      });
    }
  }, []);

  const style = {
    paddingTop: top ? `${safeAreaInsets.top}px` : undefined,
    paddingBottom: bottom ? `${safeAreaInsets.bottom}px` : undefined,
    paddingLeft: left ? `${safeAreaInsets.left}px` : undefined,
    paddingRight: right ? `${safeAreaInsets.right}px` : undefined,
  };

  return (
    <div className={cn(className)} style={style}>
      {children}
    </div>
  );
};

/**
 * SafeAreaView - 預設處理頂部和底部安全區域的容器
 */
export const SafeAreaView = ({ children, className }: { children: ReactNode; className?: string }) => {
  return (
    <SafeArea top bottom className={className}>
      {children}
    </SafeArea>
  );
};

/**
 * Hook: 獲取安全區域數值
 */
export const useSafeArea = () => {
  const [safeAreaInsets, setSafeAreaInsets] = useState({
    top: 0,
    bottom: 0,
    left: 0,
    right: 0
  });

  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      const computedStyle = getComputedStyle(document.documentElement);
      
      setSafeAreaInsets({
        top: parseInt(computedStyle.getPropertyValue('--sat') || '0'),
        bottom: parseInt(computedStyle.getPropertyValue('--sab') || '0'),
        left: parseInt(computedStyle.getPropertyValue('--sal') || '0'),
        right: parseInt(computedStyle.getPropertyValue('--sar') || '0'),
      });

      // 監聽方向改變
      const handleResize = () => {
        const style = getComputedStyle(document.documentElement);
        setSafeAreaInsets({
          top: parseInt(style.getPropertyValue('--sat') || '0'),
          bottom: parseInt(style.getPropertyValue('--sab') || '0'),
          left: parseInt(style.getPropertyValue('--sal') || '0'),
          right: parseInt(style.getPropertyValue('--sar') || '0'),
        });
      };

      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }
  }, []);

  return safeAreaInsets;
};

