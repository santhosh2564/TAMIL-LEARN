import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { ThemeId, ThemeConfig, THEMES, THEME_STORAGE_KEY, DEFAULT_THEME } from './types';

interface ThemeContextValue {
  theme: ThemeId;
  currentTheme: ThemeId;
  currentThemeConfig: ThemeConfig;
  themes: ThemeConfig[];
  setTheme: (theme: ThemeId) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeId>(() => {
    try {
      if (typeof localStorage !== 'undefined') {
        const saved = localStorage.getItem(THEME_STORAGE_KEY) as ThemeId;
        if (saved && THEMES.some((t) => t.id === saved)) {
          return saved;
        }
      }
    } catch {
      // Local storage unavailable
    }
    return DEFAULT_THEME;
  });

  // Apply data-theme attribute on root element
  useEffect(() => {
    try {
      document.documentElement.setAttribute('data-theme', theme);
    } catch {
      // Non-browser environment
    }
  }, [theme]);

  const setTheme = useCallback((newTheme: ThemeId) => {
    setThemeState(newTheme);
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(THEME_STORAGE_KEY, newTheme);
      }
      document.documentElement.setAttribute('data-theme', newTheme);
    } catch {
      // Local storage quota or restricted
    }
  }, []);

  const currentThemeConfig = useMemo(() => {
    return THEMES.find((t) => t.id === theme) || THEMES[0];
  }, [theme]);

  const value = useMemo(
    () => ({
      theme,
      currentTheme: theme,
      currentThemeConfig,
      themes: THEMES,
      setTheme,
    }),
    [theme, currentThemeConfig, setTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    const defaultCfg = THEMES.find((t) => t.id === DEFAULT_THEME) || THEMES[0];
    return {
      theme: DEFAULT_THEME,
      currentTheme: DEFAULT_THEME,
      currentThemeConfig: defaultCfg,
      themes: THEMES,
      setTheme: () => {},
    };
  }
  return context;
}

