#import <Foundation/Foundation.h>
#import <Capacitor/Capacitor.h>

CAP_PLUGIN(NativeAdPlugin, "NativeAdPlugin",
           CAP_PLUGIN_METHOD(loadNativeAd, CAPPluginReturnPromise);
)

