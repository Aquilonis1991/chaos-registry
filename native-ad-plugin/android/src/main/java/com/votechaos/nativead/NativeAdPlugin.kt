package com.votechaos.nativead

import android.graphics.Bitmap
import android.graphics.drawable.BitmapDrawable
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.util.Base64
import android.util.Log
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.google.android.gms.ads.AdListener
import com.google.android.gms.ads.AdLoader
import com.google.android.gms.ads.AdRequest
import com.google.android.gms.ads.LoadAdError
import com.google.android.gms.ads.MediaContent
import com.google.android.gms.ads.MobileAds
import com.google.android.gms.ads.nativead.NativeAd
import com.google.android.gms.ads.nativead.NativeAdOptions

@CapacitorPlugin(name = "NativeAdPlugin")
class NativeAdPlugin : Plugin() {

    companion object {
        private const val TAG = "NativeAdPlugin"
    }

    private var initialized = false
    private var currentNativeAd: NativeAd? = null
    private val mainHandler = Handler(Looper.getMainLooper())

    @PluginMethod
    fun loadNativeAd(call: PluginCall) {
        val adUnitId = call.getString("adUnitId")
        if (adUnitId.isNullOrBlank()) {
            call.reject("adUnitId is required")
            return
        }

        val activityInstance = activity
        if (activityInstance == null) {
            call.reject("Activity not available")
            return
        }

        mainHandler.post {
            @Suppress("MissingPermission") // INTERNET permission is declared in the main app's AndroidManifest.xml
            if (!initialized) {
                MobileAds.initialize(activityInstance) {
                    Log.d(TAG, "MobileAds initialized: $it")
                }
                initialized = true
            }
            val adLoader = AdLoader.Builder(activityInstance, adUnitId)
                .forNativeAd { nativeAd ->
                    currentNativeAd?.destroy()
                    currentNativeAd = nativeAd
                    val payload = JSObject()
                    payload.put("data", nativeAdToJson(nativeAd, adUnitId))
                    call.resolve(payload)
                }
                .withAdListener(object : AdListener() {
                    override fun onAdFailedToLoad(loadAdError: LoadAdError) {
                        Log.e(TAG, "Failed to load native ad: ${loadAdError.message}")
                        call.reject(loadAdError.message)
                    }
                })
                .withNativeAdOptions(
                    NativeAdOptions.Builder()
                        .setReturnUrlsForImageAssets(true)
                        .build()
                )
                .build()

            val request = AdRequest.Builder().build()
            adLoader.loadAd(request)
        }
    }

    override fun handleOnDestroy() {
        super.handleOnDestroy()
        currentNativeAd?.destroy()
        currentNativeAd = null
    }

    private fun nativeAdToJson(nativeAd: NativeAd, adUnitId: String): JSObject {
        val data = JSObject()
        data.put("adUnitId", adUnitId)
        data.put("headline", nativeAd.headline)
        data.put("body", nativeAd.body)
        data.put("callToAction", nativeAd.callToAction)
        data.put("advertiser", nativeAd.advertiser)
        data.put("store", nativeAd.store)
        data.put("price", nativeAd.price)
        data.put("starRating", nativeAd.starRating)
        data.put("adNetworkName", nativeAd.responseInfo?.mediationAdapterClassName)

        nativeAd.icon?.let { icon ->
            data.put("iconUrl", icon.uri?.toString())
            if (icon.uri == null) {
                encodeDrawable(icon.drawable)?.let { base64 ->
                    data.put("iconBase64", base64)
                }
            }
        }

        val images = nativeAd.images
        if (!images.isNullOrEmpty()) {
            val firstImage = images[0]
            val uri: Uri? = firstImage.uri
            if (uri != null) {
                data.put("imageUrl", uri.toString())
            } else {
                encodeDrawable(firstImage.drawable)?.let { base64 ->
                    data.put("imageBase64", base64)
                }
            }
        }

        nativeAd.mediaContent?.let { media ->
            data.put("mediaContent", mediaToJson(media))
        }

        return data
    }

    private fun mediaToJson(mediaContent: MediaContent): JSObject {
        val obj = JSObject()
        obj.put("hasVideoContent", mediaContent.hasVideoContent())
        obj.put("durationSeconds", mediaContent.duration)
        obj.put("aspectRatio", mediaContent.aspectRatio)
        obj.put("type", if (mediaContent.hasVideoContent()) "video" else "image")
        return obj
    }

    private fun encodeDrawable(drawable: android.graphics.drawable.Drawable?): String? {
        if (drawable == null) return null
        val bitmap = when (drawable) {
            is BitmapDrawable -> drawable.bitmap
            else -> return null
        }
        val outputStream = java.io.ByteArrayOutputStream()
        bitmap.compress(Bitmap.CompressFormat.PNG, 100, outputStream)
        val bytes = outputStream.toByteArray()
        return "data:image/png;base64," + Base64.encodeToString(bytes, Base64.NO_WRAP)
    }
}

