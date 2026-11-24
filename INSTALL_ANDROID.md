# Install BillNest on Android

## Easiest method, no APK needed (recommended)

1. Open **https://funnyspace.github.io/funnyspace/billnest/** in Google Chrome on Android.
2. Tap **Install App** in the green banner. If no prompt appears, tap the Chrome **⋮** menu and choose **Install app** or **Add to Home screen**.
3. Confirm. Open BillNest from the new **BillNest** icon on your home screen. The app runs in a standalone window and can reopen its cached pages offline.

This method does not require a Play Store account or an APK download and uses Chrome's existing local workspace data. The first installation requires an internet connection. Barcode camera permissions are requested when used.

## Android APK (test build)

If you specifically want a `.apk` file, open the [BillNest Android APK builds](https://github.com/funnyspace/funnyspace/actions/workflows/billnest-android-apk.yml), select the latest successful run, download the **BillNest-Android-APK** artifact, extract the ZIP, and install `BillNest-Android-Test.apk` on your phone.

**This APK is a test build.** Android may show an unknown-app warning and you may need to enable installs from the app used to open the APK. Do so only if you trust the source. A production-signed APK for distribution should use a persistent signing key, and be tested on physical Android devices.

**Do not lose your inventory:** the APK's Android WebView has separate local data from Chrome. Before using it, export your business data as JSON from the Chrome version (**Settings > Data & backup > Download JSON**), then restore that backup in the APK. If you want seamless continuity with the existing website data without migration, use the recommended PWA install instead.

The Android wrapper keeps live barcode scanning, image imports, UPI external app links, invoice print, and JSON/CSV export where supported. Camera behavior varies by device and Android System WebView version.

## Direct APK download from BillNest

The website also provides a **Download APK (test)** link in the mobile installation banner. Direct APK: https://funnyspace.github.io/funnyspace/billnest/download/BillNest-Android-Test.apk . The file is a debug-signed test build (not a production-signed Android release). Updates may require uninstalling and importing a backup, so prefer the PWA for daily business use.
