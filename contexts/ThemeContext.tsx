import React, { createContext, useContext, ReactNode } from 'react';

export type Theme = 'light';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Always light mode - no dark mode support
  const theme: Theme = 'light';

  // Apply light theme styling to document
  React.useEffect(() => {
    const root = document.documentElement;
    root.classList.add('light-mode');
    root.classList.remove('dark-mode');
    // Gradient background from lavender to white (matching landing page style but slightly darker)
    document.body.style.background = 'linear-gradient(180deg, #F5F3FF 0%, #F8F7FF 15%, #FAFAFF 35%, #FFFFFF 55%)';
    document.body.style.backgroundAttachment = 'fixed';
    document.body.style.color = '#1E1B4B';
  }, []);

  // No-op functions since we only support light mode
  const toggleTheme = () => {};
  const setTheme = () => {};

  const value: ThemeContextType = {
    theme,
    toggleTheme,
    setTheme,
    isDark: false // Always false - light mode only
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export default ThemeContext;
