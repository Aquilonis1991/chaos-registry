// Type definitions for cordova-plugin-purchase

declare global {
  interface Window {
    CdvPurchase?: {
      Store: any;
      ProductType: {
        CONSUMABLE: string;
        NON_CONSUMABLE: string;
        SUBSCRIPTION: string;
      };
      Platform: {
        GOOGLE_PLAY: string;
        APPLE_APPSTORE: string;
      };
    };
  }
}

export {};
