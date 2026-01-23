# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.

# Keep Source File and Line Numbers for crash reports
-keepattributes SourceFile,LineNumberTable

# Capacitor
-keep public class * extends com.getcapacitor.Plugin
-keep public class com.getcapacitor.BridgeActivity
-keep class * extends com.getcapacitor.BridgeActivity
-keep public class * extends android.webkit.WebChromeClient
-keep public class * extends android.webkit.WebViewClient

# Keep Javascript Interfaces
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Cordova Plugin Purchase (Google Play Billing)
-keep class com.android.billingclient.** { *; }
-keep class com.google.android.gms.internal.** { *; }

# VoteChaos App specific
-keep class com.votechaos.nativead.** { *; }

# Keep all Capacitor plugins to be safe (since they are often loaded via reflection)
-keep class com.getcapacitor.** { *; }
-keep class org.apache.cordova.** { *; }
