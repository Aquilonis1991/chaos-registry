import Foundation
import Capacitor
import GoogleMobileAds

@objc(NativeAdPlugin)
public class NativeAdPlugin: CAPPlugin, GADNativeAdLoaderDelegate {
    private var adLoader: GADAdLoader?
    private var currentAd: GADNativeAd?
    private var lastAdUnitId: String?

    @objc func loadNativeAd(_ call: CAPPluginCall) {
        guard let adUnitId = call.getString("adUnitId"), !adUnitId.isEmpty else {
            call.reject("adUnitId is required")
            return
        }

        DispatchQueue.main.async {
            if self.adLoader == nil {
                GADMobileAds.sharedInstance().start(completionHandler: nil)
            }

            self.adLoader = GADAdLoader(adUnitID: adUnitId,
                                        rootViewController: self.bridge?.viewController,
                                        adTypes: [.native],
                                        options: [GADNativeAdImageAdLoaderOptions()])
            self.adLoader?.delegate = self
            let request = GADRequest()
            self.adLoader?.load(request)

            self.currentCall = call
            self.lastAdUnitId = adUnitId
        }
    }

    private var currentCall: CAPPluginCall?

    public func adLoader(_ adLoader: GADAdLoader, didFailToReceiveAdWithError error: Error) {
        CAPLog.print("[NativeAdPlugin] Failed to load native ad: \(error.localizedDescription)")
        currentCall?.reject(error.localizedDescription)
        currentCall = nil
    }

    public func adLoader(_ adLoader: GADAdLoader, didReceive nativeAd: GADNativeAd) {
        currentAd?.delegate = nil
        currentAd = nativeAd
        nativeAd.delegate = self

        guard let call = currentCall else { return }
        let data = nativeAdToDict(nativeAd: nativeAd, adUnitId: adLoader.adUnitID)
        call.resolve(["data": data])
        currentCall = nil
    }

    private func nativeAdToDict(nativeAd: GADNativeAd, adUnitId: String) -> [String: Any] {
        var dict: [String: Any] = [
            "adUnitId": adUnitId,
            "headline": nativeAd.headline ?? "",
            "body": nativeAd.body ?? "",
            "callToAction": nativeAd.callToAction ?? "",
            "advertiser": nativeAd.advertiser ?? "",
            "store": nativeAd.store ?? "",
            "price": nativeAd.price ?? "",
            "starRating": nativeAd.starRating ?? 0
        ]

        if let iconUrl = nativeAd.icon?.imageURL?.absoluteString {
            dict["iconUrl"] = iconUrl
        }
        if let firstImage = nativeAd.images?.first as? GADNativeAdImage,
           let imageUrl = firstImage.imageURL?.absoluteString {
            dict["imageUrl"] = imageUrl
        }

        if let mediaContent = nativeAd.mediaContent {
            dict["mediaContent"] = [
                "hasVideoContent": mediaContent.hasVideoContent,
                "durationSeconds": mediaContent.duration,
                "aspectRatio": mediaContent.aspectRatio,
                "type": mediaContent.hasVideoContent ? "video" : "image"
            ]
        }

        return dict
    }

    public override func handleAppInvalidate() {
        super.handleAppInvalidate()
        currentAd?.delegate = nil
        currentAd = nil
        adLoader = nil
        currentCall = nil
    }
}

extension NativeAdPlugin: GADNativeAdDelegate {
    public func nativeAdDidRecordClick(_ nativeAd: GADNativeAd) {
        notifyListeners("onNativeAdClicked", data: ["adUnitId": lastAdUnitId ?? ""])
    }

    public func nativeAdDidRecordImpression(_ nativeAd: GADNativeAd) {
        notifyListeners("onNativeAdImpression", data: ["adUnitId": lastAdUnitId ?? ""])
    }
}

