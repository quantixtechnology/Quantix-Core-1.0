package in.quantixtechnology.wrapper;

import android.Manifest;
import android.annotation.SuppressLint;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.content.Intent;

import androidx.activity.OnBackPressedCallback;
import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

/**
 * A shell around one PWA. No screens, no business logic — the web app IS the
 * app, and everything this class does exists to get out of its way.
 */
public class MainActivity extends AppCompatActivity {

    private static final int REQ_CAMERA = 1001;

    private WebView web;
    /** Held between asking Android for CAMERA and hearing the answer. */
    private PermissionRequest pendingWebRequest;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        web = new WebView(this);
        setContentView(web);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);       // the PWA keeps its session here
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false); // camera starts on tap
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);

        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
                Uri uri = req.getUrl();
                String host = uri.getHost();
                String scheme = uri.getScheme();

                // tel:, mailto: and wa.me belong to other apps. The executive
                // taps Call on a job; that has to reach the dialler.
                if (scheme != null && !scheme.equals("http") && !scheme.equals("https")) {
                    startActivity(new Intent(Intent.ACTION_VIEW, uri));
                    return true;
                }
                // Anything off this tenant's own host opens in the browser, so
                // the installed app cannot be navigated somewhere else and keep
                // looking like the app.
                if (host != null && !host.equals(Uri.parse(BuildConfig.LAUNCH_URL).getHost())) {
                    startActivity(new Intent(Intent.ACTION_VIEW, uri));
                    return true;
                }
                return false;
            }
        });

        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(final PermissionRequest request) {
                runOnUiThread(() -> {
                    // Grant ONLY what was asked for, and only what we recognise.
                    // Blindly calling request.grant(request.getResources())
                    // hands the page the microphone and protected media the
                    // moment it asks for a camera.
                    boolean wantsCamera = false;
                    for (String r : request.getResources()) {
                        if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(r)) wantsCamera = true;
                    }
                    if (!wantsCamera) {
                        request.deny();
                        return;
                    }
                    if (ContextCompat.checkSelfPermission(MainActivity.this, Manifest.permission.CAMERA)
                            == PackageManager.PERMISSION_GRANTED) {
                        request.grant(new String[]{PermissionRequest.RESOURCE_VIDEO_CAPTURE});
                    } else {
                        // Ask Android first; the page waits for the answer.
                        pendingWebRequest = request;
                        // ActivityCompat, not Activity: below API 23 the platform
                        // method does not exist, and permissions were granted at
                        // install time anyway — the compat call answers straight
                        // away instead of throwing.
                        ActivityCompat.requestPermissions(MainActivity.this,
                                new String[]{Manifest.permission.CAMERA}, REQ_CAMERA);
                    }
                });
            }

            @Override
            public void onPermissionRequestCanceled(PermissionRequest request) {
                pendingWebRequest = null;
            }
        });

        // Back navigates the web history before it leaves the app, so a scan
        // screen does not close the whole thing.
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override public void handleOnBackPressed() {
                if (web.canGoBack()) web.goBack();
                else finish();
            }
        });

        web.loadUrl(BuildConfig.LAUNCH_URL);
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, @NonNull String[] permissions,
                                           @NonNull int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode != REQ_CAMERA || pendingWebRequest == null) return;

        boolean granted = grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED;
        if (granted) {
            pendingWebRequest.grant(new String[]{PermissionRequest.RESOURCE_VIDEO_CAPTURE});
        } else {
            // Denying is an answer, not a crash: the page's own "camera
            // unavailable" path takes over. If the user later enables camera in
            // Android Settings, the next scan asks again and succeeds.
            pendingWebRequest.deny();
        }
        pendingWebRequest = null;
    }
}
