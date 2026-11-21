package io.github.funnyspace.billnest;

import android.Manifest;
import android.app.Activity;
import android.app.DownloadManager;
import android.app.PrintManager;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.os.Handler;
import android.os.Looper;
import android.provider.MediaStore;
import android.util.Base64;
import android.view.View;
import android.webkit.CookieManager;
import android.webkit.DownloadListener;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.SslErrorHandler;
import android.net.http.SslError;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.util.Locale;

/**
 * Android packaging for the existing BillNest GitHub Pages app.
 * The app intentionally uses a dedicated WebView data store, separate from Chrome.
 * Export JSON from Chrome and restore in the app before entering new business data.
 */
public final class MainActivity extends Activity {
    private static final String HOME = "https://funnyspace.github.io/funnyspace/billnest/";
    private static final int REQ_CAMERA = 501;
    private static final int REQ_FILE = 502;
    private WebView web;
    private PermissionRequest pendingCamera;
    private ValueCallback<Uri[]> pendingFile;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().setStatusBarColor(Color.rgb(16,46,67));
        getWindow().setNavigationBarColor(Color.rgb(16,46,67));
        web = new WebView(this);
        web.setBackgroundColor(Color.WHITE);
        setContentView(web);
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(true);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setSupportZoom(false);
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(web, false);

        web.addJavascriptInterface(new AndroidBridge(), "BillNestAndroid");
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri target = request.getUrl();
                if (isBillNestPage(target)) return false;
                return openOutside(target);
            }
            @Override public void onReceivedSslError(WebView view, SslErrorHandler handler, SslError error) {
                handler.cancel(); // Never bypass invalid HTTPS certificates.
                Toast.makeText(MainActivity.this, "Secure connection failed. Check internet and try again.", Toast.LENGTH_LONG).show();
            }
            @Override public void onPageFinished(WebView view, String url) {
                if (isBillNestPage(Uri.parse(url))) installNativeFeatures();
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override public void onPermissionRequest(PermissionRequest request) {
                runOnUiThread(() -> {
                    Uri origin = request.getOrigin();
                    if (!"https".equals(origin.getScheme()) || !"funnyspace.github.io".equals(origin.getHost())) {
                        request.deny(); return;
                    }
                    boolean camera = false;
                    for (String resource : request.getResources()) {
                        if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(resource)) camera = true;
                    }
                    if (!camera) { request.deny(); return; }
                    if (checkSelfPermission(Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
                        request.grant(new String[]{PermissionRequest.RESOURCE_VIDEO_CAPTURE});
                    } else {
                        pendingCamera = request;
                        requestPermissions(new String[]{Manifest.permission.CAMERA}, REQ_CAMERA);
                    }
                });
            }
            @Override public boolean onShowFileChooser(WebView v, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (pendingFile != null) pendingFile.onReceiveValue(null);
                pendingFile = callback;
                String mime = "*/*";
                for (String t : params.getAcceptTypes()) {
                    if (t != null && t.startsWith("image/")) { mime = "image/*"; break; }
                }
                try {
                    Intent picker = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                    picker.addCategory(Intent.CATEGORY_OPENABLE);
                    picker.setType(mime);
                    picker.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                    startActivityForResult(picker, REQ_FILE);
                    return true;
                } catch (Exception ex) {
                    pendingFile = null;
                    callback.onReceiveValue(null);
                    Toast.makeText(MainActivity.this, "File picker unavailable", Toast.LENGTH_LONG).show();
                    return true;
                }
            }
        });
        web.setDownloadListener((url, ua, contentDisposition, mime, length) -> {
            try {
                Uri uri = Uri.parse(url);
                if (!"https".equals(uri.getScheme())) return; // Blob exports handled by AndroidBridge below.
                Intent view = new Intent(Intent.ACTION_VIEW, uri);
                startActivity(view); // Allow browser downloads; avoid writing unauthenticated URLs ourselves.
            } catch (Exception ex) { Toast.makeText(this, "Could not open download", Toast.LENGTH_LONG).show(); }
        });
        web.loadUrl(HOME);
    }

    private boolean isBillNestPage(Uri uri) {
        String path = uri.getPath();
        return "https".equals(uri.getScheme()) && "funnyspace.github.io".equals(uri.getHost())
                && path != null && (path.equals("/funnyspace/billnest") || path.startsWith("/funnyspace/billnest/"));
    }

    private boolean openOutside(Uri uri) {
        try {
            Intent intent;
            if ("intent".equals(uri.getScheme())) intent = Intent.parseUri(uri.toString(), Intent.URI_INTENT_SCHEME);
            else intent = new Intent(Intent.ACTION_VIEW, uri);
            intent.addCategory(Intent.CATEGORY_BROWSABLE);
            intent.setComponent(null);
            startActivity(intent);
        } catch (Exception ignored) {
            Toast.makeText(this, "No app is available to open that link", Toast.LENGTH_LONG).show();
        }
        return true;
    }

    private void installNativeFeatures() {
        // The regular BillNest website still runs unchanged. These hooks only provide
        // Android printing and local JSON/CSV export for the WebView APK.
        final String script = "(function(){if(window.__billnestAndroidReady)return;window.__billnestAndroidReady=true;"+
            "window.print=function(){BillNestAndroid.printInvoice();};"+
            "document.addEventListener('click',function(e){var a=e.target.closest&&e.target.closest('a[download]');"+
            "if(!a||!a.href||a.href.slice(0,5)!=='blob:')return;e.preventDefault();"+
            "fetch(a.href).then(function(r){return r.blob()}).then(function(blob){"+
            "var reader=new FileReader();reader.onload=function(){BillNestAndroid.saveDownload(a.download||'billnest-backup.json',String(reader.result));};"+
            "reader.readAsDataURL(blob);}).catch(function(){console.warn('Download failed')});},true);})();";
        web.evaluateJavascript(script, null);
    }

    private final class AndroidBridge {
        @JavascriptInterface public void printInvoice() {
            runOnUiThread(() -> {
                if (!isBillNestPage(Uri.parse(web.getUrl()))) return;
                try {
                    PrintManager pm = (PrintManager)getSystemService(Context.PRINT_SERVICE);
                    pm.print("BillNest invoice", web.createPrintDocumentAdapter("BillNest invoice"), null);
                } catch (Exception ex) { Toast.makeText(MainActivity.this, "Print unavailable", Toast.LENGTH_LONG).show(); }
            });
        }

        @JavascriptInterface public void saveDownload(String requestedName, String dataUrl) {
            // Limit bridge inputs before allocation. Only local BillNest JSON and CSV exports.
            if (dataUrl == null || dataUrl.length() > 16_000_000 || !dataUrl.startsWith("data:")) return;
            runOnUiThread(() -> {
                if (!isBillNestPage(Uri.parse(web.getUrl()))) return;
                try {
                    int comma = dataUrl.indexOf(',');
                    if (comma < 0 || comma > 120 || !dataUrl.substring(0, comma).contains(";base64")) return;
                    String mime = dataUrl.substring(5, comma).split(";")[0].toLowerCase(Locale.ROOT);
                    if (!("application/json".equals(mime) || "text/csv".equals(mime) || "text/plain".equals(mime))) return;
                    byte[] bytes = Base64.decode(dataUrl.substring(comma + 1), Base64.DEFAULT);
                    if (bytes.length > 12_000_000) return;
                    String safe = requestedName == null ? "billnest-backup.json" : requestedName.replaceAll("[^a-zA-Z0-9_.-]", "_");
                    if (safe.length() < 3 || safe.length() > 110) safe = "billnest-backup.json";
                    saveToDownloads(safe, mime, bytes);
                    Toast.makeText(MainActivity.this, "Saved to Downloads: " + safe, Toast.LENGTH_LONG).show();
                } catch (Exception ex) { Toast.makeText(MainActivity.this, "Could not save file", Toast.LENGTH_LONG).show(); }
            });
        }
    }

    private void saveToDownloads(String name, String mime, byte[] bytes) throws Exception {
        if (Build.VERSION.SDK_INT >= 29) {
            ContentValues values = new ContentValues();
            values.put(MediaStore.Downloads.DISPLAY_NAME, name);
            values.put(MediaStore.Downloads.MIME_TYPE, mime);
            values.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/BillNest");
            values.put(MediaStore.Downloads.IS_PENDING, 1);
            Uri uri = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
            if (uri == null) throw new IllegalStateException("Download storage unavailable");
            try (OutputStream out = getContentResolver().openOutputStream(uri)) {
                if (out == null) throw new IllegalStateException("Could not open Downloads");
                out.write(bytes);
            }
            values.clear(); values.put(MediaStore.Downloads.IS_PENDING, 0);
            getContentResolver().update(uri, values, null, null);
        } else {
            File dir = getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
            if (dir == null) throw new IllegalStateException("App storage unavailable");
            try (FileOutputStream out = new FileOutputStream(new File(dir, name))) { out.write(bytes); }
        }
    }

    @Override protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == REQ_FILE && pendingFile != null) {
            Uri uri = resultCode == RESULT_OK && data != null ? data.getData() : null;
            pendingFile.onReceiveValue(uri != null ? new Uri[]{uri} : null);
            pendingFile = null;
        }
    }

    @Override public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grants) {
        super.onRequestPermissionsResult(requestCode, permissions, grants);
        if (requestCode == REQ_CAMERA && pendingCamera != null) {
            if (grants.length > 0 && grants[0] == PackageManager.PERMISSION_GRANTED) {
                pendingCamera.grant(new String[]{PermissionRequest.RESOURCE_VIDEO_CAPTURE});
            } else pendingCamera.deny();
            pendingCamera = null;
        }
    }

    @Override public void onBackPressed() {
        if (web != null && web.canGoBack()) web.goBack();
        else super.onBackPressed();
    }

    @Override protected void onDestroy() {
        if (pendingFile != null) pendingFile.onReceiveValue(null);
        if (pendingCamera != null) pendingCamera.deny();
        if (web != null) web.destroy();
        super.onDestroy();
    }
}
