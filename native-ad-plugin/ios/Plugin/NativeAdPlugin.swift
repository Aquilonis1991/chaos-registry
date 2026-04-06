import Foundation
import Capacitor
import GoogleMobileAds
import UIKit

@objc(NativeAdPlugin)
public class NativeAdPlugin: CAPPlugin, GADNativeAdLoaderDelegate, GADNativeAdDelegate {
    private var adLoader: GADAdLoader?
    private var loadingCall: CAPPluginCall?
    private var lastAdData: [String: Any]?

    @objc func loadNativeAd(_ call: CAPPluginCall) {
        let adUnitId = (call.getString("adUnitId") ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        guard !adUnitId.isEmpty else {
            call.resolve(["error": "MISSING_AD_UNIT_ID"])
            return
        }

        if loadingCall != nil {
            call.resolve(["error": "LOAD_IN_PROGRESS"])
            return
        }

        loadingCall = call

        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            let rootVC = self.bridge?.viewController
            let loader = GADAdLoader(
                adUnitID: adUnitId,
                rootViewController: rootVC,
                adTypes: [.native],
                options: nil
            )
            loader.delegate = self
            self.adLoader = loader

            // 隱私防護：固定使用非個人化廣告請求，避免觸發追蹤用途。
            let request = GADRequest()
            let extras = GADExtras()
            extras.additionalParameters = ["npa": "1"]
            request.register(extras)
            loader.load(request)
        }
    }

    // MARK: - GADNativeAdLoaderDelegate
    public func adLoader(_ adLoader: GADAdLoader, didReceive nativeAd: GADNativeAd) {
        nativeAd.delegate = self

        var payload: [String: Any] = ["headline": nativeAd.headline]

        if let value = nativeAd.body { payload["body"] = value }
        if let value = nativeAd.callToAction { payload["callToAction"] = value }
        if let value = nativeAd.advertiser { payload["advertiser"] = value }
        if let value = nativeAd.store { payload["store"] = value }
        if let value = nativeAd.price { payload["price"] = value }
        if let value = nativeAd.starRating?.doubleValue { payload["starRating"] = value }
        if let value = nativeAd.responseInfo.loadedAdNetworkResponseInfo?.adNetworkClassName {
            payload["adNetworkName"] = value
        }

        if let icon = nativeAd.icon?.image, let base64 = encodeImage(icon) {
            payload["iconBase64"] = base64
        }

        if let firstImage = nativeAd.images?.first?.image, let base64 = encodeImage(firstImage) {
            payload["imageBase64"] = base64
        }

        let mediaContent = nativeAd.mediaContent
        payload["mediaContent"] = [
            "type": mediaContent.hasVideoContent ? "video" : "image",
            "aspectRatio": Double(mediaContent.aspectRatio)
        ]

        lastAdData = payload
        loadingCall?.resolve(["data": payload])
        loadingCall = nil
    }

    public func adLoader(_ adLoader: GADAdLoader, didFailToReceiveAdWithError error: Error) {
        let nsError = error as NSError
        // 常見：GADErrorDomain code=1 (noFill)
        let detail = "NATIVE_AD_LOAD_FAILED domain=\(nsError.domain) code=\(nsError.code) msg=\(nsError.localizedDescription)"
        loadingCall?.resolve(["error": detail])
        loadingCall = nil
    }

    // MARK: - GADNativeAdDelegate
    public func nativeAdDidRecordClick(_ nativeAd: GADNativeAd) {
        guard let data = lastAdData else { return }
        notifyListeners("onNativeAdClicked", data: data)
    }

    public func nativeAdDidRecordImpression(_ nativeAd: GADNativeAd) {
        guard let data = lastAdData else { return }
        notifyListeners("onNativeAdImpression", data: data)
    }

    // MARK: - Helpers
    private func encodeImage(_ image: UIImage) -> String? {
        guard let jpegData = image.jpegData(compressionQuality: 0.9) else {
            return nil
        }
        return "data:image/jpeg;base64,\(jpegData.base64EncodedString())"
    }
}
