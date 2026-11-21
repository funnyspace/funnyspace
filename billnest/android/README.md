# BillNest Android APK source

This is a small Android WebView wrapper around the existing BillNest GitHub Pages website.
It uses Android camera permissions for the live barcode scanner, an Android file picker for photo and JSON backup imports, native PrintManager for invoice printing, an Android Downloads writer for JSON/CSV exports, and opens `upi://pay` intents in installed UPI apps.

**For most users, installing the BillNest PWA from Chrome is recommended.** It installs directly from the website, keeps Chrome's existing local browser storage, provides the same icon and standalone app window, and does not require sideloading an APK.

## Build and install an APK from GitHub

1. Go to [BillNest Android APK workflow](https://github.com/funnyspace/funnyspace/actions/workflows/billnest-android-apk.yml).
2. Choose the latest successful **BillNest Android test APK** workflow run. Under **Artifacts**, download `BillNest-Android-APK`.
3. Extract the ZIP and copy `BillNest-Android-Test.apk` to your phone.
4. Open the APK. If Android blocks it, follow Android's one-time **Allow from this source** prompt only if you trust this repository and its code. Install the app.
5. Open BillNest. The first launch requires internet so the website can load. Subsequent offline behavior depends on the website service worker and the Android WebView version.

**Current GitHub Actions build is a DEBUG/TEST APK, not a production-signed release.** Debug signing generated separately on each runner is not suitable for seamless future APK updates. Use a stable private release keystore for a production-signed APK. Never commit the private keystore or password to GitHub.

## Local Android build

Requirements: Android SDK 35, Android Build Tools 35.0.0, JDK 17, Gradle 8.9.

```sh
cd billnest/android
gradle assembleDebug
# APK: app/build/outputs/apk/debug/app-debug.apk
```

Open `billnest/android/` as a project in Android Studio if you prefer a graphical build.

## Existing data, permissions and limitations

- **Chrome and this APK do not share localStorage**. Before moving to the APK, export a JSON backup from **BillNest > Settings > Data & backup** in Chrome, then open the installed app and import the JSON backup. Never uninstall the existing app or clear Chrome before confirming the import worked.
- Android permissions: **Camera** is requested only when the website asks to scan a barcode. Internet is required for the initial website load and for optional cloud sync.
- Photo/image and JSON backup imports use Android's system document picker.
- CSV/JSON downloads are saved under Downloads/BillNest on Android 10+.
- The Android app loads **https://funnyspace.github.io/funnyspace/billnest/** only. External links and UPI payment intents open the corresponding external app/browser.
- No digital-asset-links verification is required because this is a WebView wrapper, not a Trusted Web Activity.
- If Chrome supports camera focus or torch controls better than Android WebView on your particular phone, use the PWA for reliable barcode scanning.
- This is not a Play Store release, nor a background service. Optional Supabase cloud backup still requires user configuration.
