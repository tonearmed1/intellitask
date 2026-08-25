import { api } from "@/lib/api";
import type { AppSettings } from "@shared/types";

export interface SettingsResponse {
  settings: AppSettings;
  availableProviders: string[];
  envDefaults: {
    aiProvider: string;
    aiModel: string;
    anthropicConfigured: boolean;
    openaiConfigured: boolean;
    researchConfigured: boolean;
  };
}

export const settingsService = {
  get: () => api.get<SettingsResponse>("/api/settings"),
  update: (patch: Partial<AppSettings>) =>
    api.patch<{ settings: AppSettings }>("/api/settings", patch),
};
