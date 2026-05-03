import { describe, it, expect, beforeEach } from "vitest";
import {
  useSettingsStore,
  selectActiveAIConfig,
} from "@/stores/settings";
import type { AIProviderConfig } from "@/types/stampify";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const azureProvider: AIProviderConfig = {
  type: "azure",
  apiKey: "az-key-123",
  endpoint: "https://my-azure.openai.azure.com",
  model: "gpt-4o",
  isDefault: false,
};

const openaiProvider: AIProviderConfig = {
  type: "openai",
  apiKey: "sk-key-456",
  model: "gpt-4o",
  isDefault: true,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useSettingsStore", () => {
  beforeEach(() => {
    useSettingsStore.getState().reset();
  });

  // ---- default state -----------------------------------------------------

  it("has correct default state", () => {
    const { settings } = useSettingsStore.getState();
    expect(settings.theme).toBe("system");
    expect(settings.ai.providers).toEqual([]);
    expect(settings.ai.activeProvider).toBeNull();
  });

  // ---- addProvider -------------------------------------------------------

  it("addProvider appends a provider to the list", () => {
    useSettingsStore.getState().addProvider(azureProvider);

    const { settings } = useSettingsStore.getState();
    expect(settings.ai.providers).toHaveLength(1);
    expect(settings.ai.providers[0]).toEqual(azureProvider);
  });

  it("addProvider can add multiple providers", () => {
    useSettingsStore.getState().addProvider(azureProvider);
    useSettingsStore.getState().addProvider(openaiProvider);

    const { settings } = useSettingsStore.getState();
    expect(settings.ai.providers).toHaveLength(2);
    expect(settings.ai.providers[0].type).toBe("azure");
    expect(settings.ai.providers[1].type).toBe("openai");
  });

  // ---- removeProvider ----------------------------------------------------

  it("removeProvider removes the provider at the given index", () => {
    useSettingsStore.getState().addProvider(azureProvider);
    useSettingsStore.getState().addProvider(openaiProvider);
    useSettingsStore.getState().removeProvider(0);

    const { settings } = useSettingsStore.getState();
    expect(settings.ai.providers).toHaveLength(1);
    expect(settings.ai.providers[0].type).toBe("openai");
  });

  it("removeProvider clears activeProvider if it was the removed type", () => {
    useSettingsStore.getState().addProvider(azureProvider);
    useSettingsStore.getState().setActiveProvider("azure");
    expect(useSettingsStore.getState().settings.ai.activeProvider).toBe("azure");

    useSettingsStore.getState().removeProvider(0);
    expect(useSettingsStore.getState().settings.ai.activeProvider).toBeNull();
  });

  it("removeProvider keeps activeProvider if a different type was removed", () => {
    useSettingsStore.getState().addProvider(azureProvider);
    useSettingsStore.getState().addProvider(openaiProvider);
    useSettingsStore.getState().setActiveProvider("openai");

    // Remove azure (index 0), openai should remain active
    useSettingsStore.getState().removeProvider(0);
    expect(useSettingsStore.getState().settings.ai.activeProvider).toBe(
      "openai",
    );
  });

  // ---- setActiveProvider -------------------------------------------------

  it("setActiveProvider sets the active provider type", () => {
    useSettingsStore.getState().addProvider(openaiProvider);
    useSettingsStore.getState().setActiveProvider("openai");

    expect(useSettingsStore.getState().settings.ai.activeProvider).toBe(
      "openai",
    );
  });

  it("setActiveProvider can be set to null", () => {
    useSettingsStore.getState().setActiveProvider("openai");
    useSettingsStore.getState().setActiveProvider(null);

    expect(useSettingsStore.getState().settings.ai.activeProvider).toBeNull();
  });

  // ---- setTheme ----------------------------------------------------------

  it("setTheme changes the theme", () => {
    useSettingsStore.getState().setTheme("dark");
    expect(useSettingsStore.getState().settings.theme).toBe("dark");

    useSettingsStore.getState().setTheme("light");
    expect(useSettingsStore.getState().settings.theme).toBe("light");

    useSettingsStore.getState().setTheme("system");
    expect(useSettingsStore.getState().settings.theme).toBe("system");
  });

  // ---- selectActiveAIConfig ----------------------------------------------

  it("selectActiveAIConfig returns null when no active provider", () => {
    const config = selectActiveAIConfig(useSettingsStore.getState());
    expect(config).toBeNull();
  });

  it("selectActiveAIConfig returns the matching provider config", () => {
    useSettingsStore.getState().addProvider(azureProvider);
    useSettingsStore.getState().addProvider(openaiProvider);
    useSettingsStore.getState().setActiveProvider("openai");

    const config = selectActiveAIConfig(useSettingsStore.getState());
    expect(config).toEqual(openaiProvider);
  });

  // ---- loadSettings ------------------------------------------------------

  it("loadSettings replaces the entire settings object", () => {
    useSettingsStore.getState().loadSettings({
      theme: "dark",
      ai: {
        providers: [openaiProvider],
        activeProvider: "openai",
      },
    });

    const { settings } = useSettingsStore.getState();
    expect(settings.theme).toBe("dark");
    expect(settings.ai.providers).toHaveLength(1);
    expect(settings.ai.activeProvider).toBe("openai");
  });

  // ---- updateProvider ----------------------------------------------------

  it("updateProvider replaces the provider at the given index", () => {
    useSettingsStore.getState().addProvider(azureProvider);
    const updated: AIProviderConfig = {
      ...azureProvider,
      model: "gpt-4o-mini",
    };
    useSettingsStore.getState().updateProvider(0, updated);

    const { settings } = useSettingsStore.getState();
    expect(settings.ai.providers[0].model).toBe("gpt-4o-mini");
  });
});
