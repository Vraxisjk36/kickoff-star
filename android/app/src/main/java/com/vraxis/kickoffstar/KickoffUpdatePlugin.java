package com.vraxis.kickoffstar;

import android.app.AlertDialog;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.PluginMethod;
import com.google.android.play.core.appupdate.AppUpdateManager;
import com.google.android.play.core.appupdate.AppUpdateManagerFactory;
import com.google.android.play.core.install.InstallStateUpdatedListener;
import com.google.android.play.core.install.model.AppUpdateType;
import com.google.android.play.core.install.model.InstallStatus;
import com.google.android.play.core.install.model.UpdateAvailability;

@CapacitorPlugin(name = "KickoffUpdate")
public class KickoffUpdatePlugin extends Plugin {
  private AppUpdateManager manager;
  private InstallStateUpdatedListener listener;
  private boolean showingInstallPrompt = false;

  @PluginMethod
  public void check(PluginCall call) {
    if (getActivity() == null) { call.resolve(); return; }
    if (manager == null) manager = AppUpdateManagerFactory.create(getContext());
    manager.getAppUpdateInfo().addOnCompleteListener(task -> {
      if (!task.isSuccessful() || getActivity() == null) { call.resolve(); return; }
      var info = task.getResult();
      if (info.installStatus() == InstallStatus.DOWNLOADED) {
        promptInstall();
      } else if (info.updateAvailability() == UpdateAvailability.UPDATE_AVAILABLE
          && info.clientVersionStalenessDays() != null && info.clientVersionStalenessDays() >= 3
          && info.isUpdateTypeAllowed(AppUpdateType.FLEXIBLE)) {
        getActivity().runOnUiThread(() -> {
          if (listener == null) {
            listener = state -> { if (state.installStatus() == InstallStatus.DOWNLOADED) promptInstall(); };
            manager.registerListener(listener);
          }
          try { manager.startUpdateFlowForResult(info, AppUpdateType.FLEXIBLE, getActivity(), 4171); }
          catch (Exception ignored) { /* Play is unavailable or update was dismissed. */ }
        });
      }
      call.resolve();
    });
  }

  private void promptInstall() {
    if (getActivity() == null || showingInstallPrompt) return;
    getActivity().runOnUiThread(() -> {
      if (getActivity() == null || showingInstallPrompt) return;
      showingInstallPrompt = true;
      new AlertDialog.Builder(getActivity())
        .setTitle("Update ready")
        .setMessage("Install the new Kickoff Star update? Your saved careers will remain on this device.")
        .setPositiveButton("Install", (dialog, which) -> manager.completeUpdate())
        .setNegativeButton("Later", (dialog, which) -> {})
        .setOnDismissListener(dialog -> showingInstallPrompt = false)
        .show();
    });
  }

  @Override
  protected void handleOnDestroy() {
    if (manager != null && listener != null) manager.unregisterListener(listener);
    super.handleOnDestroy();
  }
}
