import { useEffect, useState } from "react";
import type { AiProviderName, AppSettings } from "@shared/types";
import type { SettingsResponse } from "@/services/settings";
import { settingsService } from "@/services/settings";
import { Spinner } from "@/components/Spinner";
import { Label, Select } from "@/components/Input";
import { useToast } from "@/components/Toast";
import { ApiError } from "@/lib/api";
import { applyTheme, storeThemePreference, type ThemePreference } from "@/lib/theme";

const PROVIDER_LABEL: Record<AiProviderName, string> = {
  mock: "Mock (offline, deterministic — used for tests)",
  anthropic: "Anthropic",
  openai: "OpenAI",
};

export default function SettingsPage() {
  const { show } = useToast();
  const [data, setData] = useState<SettingsResponse | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    settingsService
      .get()
      .then(setData)
      .catch((err) => show(err instanceof ApiError ? err.message : "Couldn't load settings.", "error"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function update(patch: Partial<AppSettings>) {
    if (!data) return;
    setSaving(true);
    try {
      const res = await settingsService.update(patch);
      setData((prev) => (prev ? { ...prev, settings: res.settings } : prev));
      if (patch.theme) {
        storeThemePreference(patch.theme as ThemePreference);
        applyTheme(patch.theme as ThemePreference);
      }
      show("Settings saved.", "success");
    } catch (err) {
      show(err instanceof ApiError ? err.message : "Couldn't save settings.", "error");
    } finally {
      setSaving(false);
    }
  }

  if (!data) {
    return (
      <div className="flex justify-center py-16">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }

  const { settings, envDefaults } = data;

  return (
    <div className="max-w-xl">
      <h1 className="mb-6 text-lg font-semibold text-neutral-900 dark:text-neutral-100">Settings</h1>

      <div className="space-y-6">
        <section className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-neutral-400">
            AI provider
          </h2>
          <div className="space-y-3">
            <div>
              <Label htmlFor="settings-provider">Provider</Label>
              <Select
                id="settings-provider"
                value={settings.aiProvider}
                disabled={saving}
                onChange={(e) => update({ aiProvider: e.target.value as AiProviderName })}
              >
                {(["mock", "anthropic", "openai"] as AiProviderName[]).map((p) => (
                  <option key={p} value={p}>
                    {PROVIDER_LABEL[p]}
                  </option>
                ))}
              </Select>
            </div>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Model is configured via the <code>AI_MODEL</code> environment variable (currently
              "{envDefaults.aiModel}"). API keys are configured server-side only and are never sent to
              the browser.
            </p>
            <ul className="text-xs text-neutral-500 dark:text-neutral-400">
              <li>Anthropic key configured: {envDefaults.anthropicConfigured ? "Yes" : "No"}</li>
              <li>OpenAI key configured: {envDefaults.openaiConfigured ? "Yes" : "No"}</li>
            </ul>
          </div>
        </section>

        <section className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-neutral-400">
            Web research
          </h2>
          <label className="flex items-center gap-2 text-sm text-neutral-700 dark:text-neutral-300">
            <input
              type="checkbox"
              checked={settings.allowWebResearch}
              disabled={saving}
              onChange={(e) => update({ allowWebResearch: e.target.checked })}
            />
            Allow the planner to use current web information when it judges it useful
          </label>
          <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
            Search provider configured: {envDefaults.researchConfigured ? "Yes (Brave Search)" : "No — a mock provider is used"}
          </p>
        </section>

        <section className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-neutral-400">
            Appearance
          </h2>
          <div>
            <Label htmlFor="settings-theme">Theme</Label>
            <Select
              id="settings-theme"
              value={settings.theme}
              disabled={saving}
              onChange={(e) => update({ theme: e.target.value as AppSettings["theme"] })}
            >
              <option value="system">System</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </Select>
          </div>
        </section>
      </div>
    </div>
  );
}
