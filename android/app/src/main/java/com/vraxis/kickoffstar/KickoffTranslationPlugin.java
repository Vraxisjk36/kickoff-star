package com.vraxis.kickoffstar;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.PluginMethod;
import com.google.mlkit.common.model.DownloadConditions;
import com.google.mlkit.nl.translate.TranslateLanguage;
import com.google.mlkit.nl.translate.Translation;
import com.google.mlkit.nl.translate.Translator;
import com.google.mlkit.nl.translate.TranslatorOptions;
import com.google.android.gms.tasks.Task;
import com.google.android.gms.tasks.Tasks;
import org.json.JSONException;
import java.util.ArrayList;
import java.util.List;

@CapacitorPlugin(name = "KickoffTranslation")
public class KickoffTranslationPlugin extends Plugin {
  private Translator translator;
  private String target;
  private boolean ready;

  @PluginMethod
  public void prepare(PluginCall call) {
    String requested = call.getString("language");
    String code = requested == null ? null : requested.split("-")[0];
    String supported = code == null ? null : TranslateLanguage.fromLanguageTag(code);
    if (supported == null) { call.reject("Unsupported language"); return; }
    if (translator != null && supported.equals(target) && ready) { call.resolve(); return; }
    if (translator != null) translator.close();
    ready = false;
    target = supported;
    TranslatorOptions options = new TranslatorOptions.Builder()
      .setSourceLanguage(TranslateLanguage.ENGLISH)
      .setTargetLanguage(supported)
      .build();
    translator = Translation.getClient(options);
    Translator requestedTranslator = translator;
    requestedTranslator.downloadModelIfNeeded(new DownloadConditions.Builder().build())
      .addOnSuccessListener(unused -> {
        if (translator != requestedTranslator) { call.reject("Language changed"); return; }
        ready = true;
        call.resolve();
      })
      .addOnFailureListener(error -> call.reject("Language pack unavailable", error));
  }

  @PluginMethod
  public void translateBatch(PluginCall call) {
    if (!ready || translator == null) { call.reject("Language pack is not ready"); return; }
    JSArray inputs = call.getArray("texts");
    if (inputs == null || inputs.length() > 40) { call.reject("Invalid translation batch"); return; }
    List<String> texts = new ArrayList<>();
    try {
      for (int i = 0; i < inputs.length(); i++) {
        String text = inputs.getString(i);
        if (text.length() > 1800) { call.reject("Translation text too long"); return; }
        texts.add(text);
      }
    } catch (JSONException error) { call.reject("Invalid translation text", error); return; }
    Translator current = translator;
    List<Task<String>> jobs = new ArrayList<>();
    for (String text : texts) jobs.add(current.translate(text));
    Tasks.whenAllSuccess(jobs)
      .addOnSuccessListener(outputs -> {
        if (current != translator) { call.reject("Language changed"); return; }
        JSObject response = new JSObject();
        response.put("texts", new JSArray(outputs));
        call.resolve(response);
      })
      .addOnFailureListener(error -> call.reject("Translation failed", error));
  }

  @Override
  protected void handleOnDestroy() {
    if (translator != null) translator.close();
    translator = null;
    super.handleOnDestroy();
  }
}
