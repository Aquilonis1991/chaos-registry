import { registerPlugin } from "@capacitor/core";
import { isNative } from "@/lib/capacitor";

export interface ReceiptReaderResult {
  receiptData?: string;
}

export interface ReceiptReaderPlugin {
  getReceipt(): Promise<ReceiptReaderResult>;
}

// Web build / Vercel 需要此檔案存在；非原生時回傳空即可。
export const ReceiptReader: ReceiptReaderPlugin = isNative()
  ? (registerPlugin<ReceiptReaderPlugin>("ReceiptReader") as unknown as ReceiptReaderPlugin)
  : {
      async getReceipt() {
        return {};
      },
    };

