import { cn } from "@/lib/utils";

interface LogoProps {
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  showBackground?: boolean;
}

const sizeMap = {
  sm: "h-8 w-8",
  md: "h-10 w-10",
  lg: "h-12 w-12",
  xl: "h-16 w-16 sm:h-20 sm:w-20",
};

const paddingMap = {
  sm: "p-1",
  md: "p-1.5",
  lg: "p-2",
  xl: "p-2.5",
};

export const Logo = ({ 
  size = "md", 
  className,
  showBackground = true 
}: LogoProps) => {
  const imageSize = sizeMap[size];
  const padding = paddingMap[size];
  
  const logoContent = (
    <img 
      src="/logo.png" 
      alt="ChaosRegistry Logo" 
      className={cn(
        imageSize,
        "rounded-full object-cover",
        className
      )}
      loading="lazy"
    />
  );

  if (showBackground) {
    // 計算實際尺寸（rem 轉換）
    // 減少 padding，確保圖片有足夠空間顯示
    const sizeMapPx = {
      sm: { container: '2.5rem', image: '2.25rem', padding: '0.125rem' },
      md: { container: '3rem', image: '2.75rem', padding: '0.125rem' },
      lg: { container: '3.5rem', image: '3.25rem', padding: '0.125rem' },
      xl: { container: '5rem', image: '4.75rem', padding: '0.125rem' },
    };
    const dimensions = sizeMapPx[size];
    
    return (
      <div 
        className={cn(
          "flex items-center justify-center",
          "rounded-full"
        )}
        style={{
          backgroundColor: '#ffffff', // 純白色背景
          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -2px rgba(0, 0, 0, 0.2)',
          borderRadius: '9999px', // 確保圓形
          padding: dimensions.padding, // 使用最小的 padding
          width: dimensions.container,
          height: dimensions.container,
          minWidth: dimensions.container,
          minHeight: dimensions.container,
          boxSizing: 'border-box' as const,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        } as React.CSSProperties}
      >
        <img 
          src="/logo.png" 
          alt="ChaosRegistry Logo" 
          className={cn(
            "rounded-full object-cover",
            className
          )}
          style={{
            width: dimensions.image,
            height: dimensions.image,
            display: 'block',
            maxWidth: '100%',
            maxHeight: '100%',
          } as React.CSSProperties}
          loading="lazy"
        />
      </div>
    );
  }

  return logoContent;
};

