import { create } from "zustand";
import type {
  AIProviderConfig,
  AIProviderType,
  UserAISettings,
  UserSettings,
} from "@/types/stampify";

// ---------------------------------------------------------------------------
// State & Actions
// ---------------------------------------------------------------------------

interface SettingsState {
  settings: UserSettings;
}

interface SettingsActions {
  setTheme: (theme: UserSettings["theme"]) => void;
  addProvider: (config: AIProviderConfig) => void;
  updateProvider: (index: number, config: AIProviderConfig) => void;
  removeProvider: (index: number) => void;
  setActiveProvider: (type: AIProviderType | null) => void;
  loadSettings: (settings: UserSettings) => void;
  reset: () => void;
}

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

const defaultAI: UserAISettings = {
  providers: [],
  activeProvider: null,
};

const initialState: SettingsState = {
  settings: {
    theme: "system",
    ai: defaultAI,
  },
};

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useSettingsStore = create<SettingsState & SettingsActions>()(
  (set) => ({
    ...initialState,

    setTheme: (theme) =>
      set((state) => ({
        settings: { ...state.settings, theme },
      })),

    addProvider: (config) =>
      set((state) => ({
        settings: {
          ...state.settings,
          ai: {
            ...state.settings.ai,
            providers: [...state.settings.ai.providers, config],
          },
        },
      })),

    updateProvider: (index, config) =>
      set((state) => ({
        settings: {
          ...state.settings,
          ai: {
            ...state.settings.ai,
            providers: state.settings.ai.providers.map((p, i) =>
              i === index ? config : p,
            ),
          },
        },
      })),

    removeProvider: (index) =>
      set((state) => {
        const providers = state.settings.ai.providers.filter(
          (_, i) => i !== index,
        );
        const removed = state.settings.ai.providers[index];
        // If the removed provider was the active one, clear activeProvider
        const activeProvider =
          removed && state.settings.ai.activeProvider === removed.type
            ? null
            : state.settings.ai.activeProvider;
        return {
          settings: {
            ...state.settings,
            ai: { providers, activeProvider },
          },
        };
      }),

    setActiveProvider: (type) =>
      set((state) => ({
        settings: {
          ...state.settings,
          ai: { ...state.settings.ai, activeProvider: type },
        },
      })),

    loadSettings: (settings) => set({ settings }),

    reset: () => set(initialState),
  }),
);

// ---------------------------------------------------------------------------
// Selectors
// ---------------------------------------------------------------------------

/**
 * Returns the AIProviderConfig for the currently active provider, or null.
 */
export function selectActiveAIConfig(
  state: SettingsState & SettingsActions,
): AIProviderConfig | null {
  const { activeProvider, providers } = state.settings.ai;
  if (!activeProvider) return null;
  return providers.find((p) => p.type === activeProvider) ?? null;
}
