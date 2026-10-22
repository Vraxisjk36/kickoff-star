package com.vraxis.kickoffstar;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.PluginMethod;
import com.google.android.play.core.review.ReviewInfo;
import com.google.android.play.core.review.ReviewManager;
import com.google.android.play.core.review.ReviewManagerFactory;

@CapacitorPlugin(name = "KickoffReview")
public class KickoffReviewPlugin extends Plugin {
  @PluginMethod
  public void request(PluginCall call) {
    ReviewManager manager = ReviewManagerFactory.create(getContext());
    manager.requestReviewFlow().addOnCompleteListener(task -> {
      if (!task.isSuccessful()) {
        // A missing Play Store or exhausted review flow must never stop the game.
        call.resolve();
        return;
      }
      ReviewInfo info = task.getResult();
      getActivity().runOnUiThread(() -> manager.launchReviewFlow(getActivity(), info)
        .addOnCompleteListener(flow -> call.resolve()));
    });
  }
}
