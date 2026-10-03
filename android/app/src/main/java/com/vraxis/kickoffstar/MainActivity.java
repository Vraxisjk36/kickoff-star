package com.vraxis.kickoffstar;

import android.os.Bundle;
import androidx.core.view.WindowCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  @Override
  protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    // Backward-compatible edge-to-edge; Capacitor SystemBars exposes the
    // actual system-bar and cutout insets to the web UI.
    WindowCompat.enableEdgeToEdge(getWindow());
  }

  @Override
  public void onBackPressed() {
    if (bridge != null && bridge.getWebView() != null) {
      bridge.getWebView().evaluateJavascript(
        "window.dispatchEvent(new Event('kickoffstar:native-back'))", null);
      return;
    }
    super.onBackPressed();
  }

  @Override
  public void onPause() {
    super.onPause();
    if (bridge != null && bridge.getWebView() != null) bridge.getWebView().onPause();
  }

  @Override
  public void onResume() {
    super.onResume();
    if (bridge != null && bridge.getWebView() != null) bridge.getWebView().onResume();
  }
}
