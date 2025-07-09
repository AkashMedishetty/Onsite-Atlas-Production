import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

// Helper function to detect system theme preference
const getSystemTheme = () => {
  if (typeof window !== 'undefined') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'light';
};

// Helper function to get stored theme preference
const getStoredTheme = () => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('theme-preference') || 'system';
  }
  return 'system';
};

export const ThemeProvider = ({ children, eventId }) => {
  // UI Theme State (dark/light/system)
  const [uiTheme, setUITheme] = useState(getStoredTheme());
  const [resolvedTheme, setResolvedTheme] = useState('light');
  
  // Event-specific theme state (existing functionality)
  const [theme, setTheme] = useState({
    primaryColor: '#8B5CF6', // Updated to purple for ClickUp style
    secondaryColor: '#3B82F6',
    accentColor: '#F59E0B',
    backgroundColor: '#F8FAFC',
    textColor: '#1F2937',
    cardBackground: '#FFFFFF',
    borderColor: '#E5E7EB',
    brandFont: 'Inter',
    borderRadius: '0.5rem',
    shadowIntensity: 'medium'
  });

  const [loading, setLoading] = useState(false);

  // UI Theme Management Effects
  useEffect(() => {
    // Resolve theme based on preference
    const resolveTheme = () => {
      if (uiTheme === 'system') {
        return getSystemTheme();
      }
      return uiTheme;
    };

    const newResolvedTheme = resolveTheme();
    setResolvedTheme(newResolvedTheme);

    // Apply theme to DOM
    const root = document.documentElement;
    if (newResolvedTheme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }

    // Store preference
    localStorage.setItem('theme-preference', uiTheme);
  }, [uiTheme]);

  // Listen for system theme changes
  useEffect(() => {
    if (uiTheme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = () => {
        const newResolvedTheme = getSystemTheme();
        setResolvedTheme(newResolvedTheme);
        
        const root = document.documentElement;
        if (newResolvedTheme === 'dark') {
          root.classList.add('dark');
        } else {
          root.classList.remove('dark');
        }
      };

      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, [uiTheme]);

  // Load event-specific theme
  useEffect(() => {
    const loadEventTheme = async () => {
      if (!eventId) return;
      
      setLoading(true);
      try {
        const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/events/${eventId}/theme`);
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.data) {
            setTheme(prevTheme => ({
              ...prevTheme,
              ...data.data
            }));
            
            // Apply CSS custom properties for dynamic theming
            applyThemeToDOM(data.data);
          }
        }
      } catch (error) {
        console.error('Error loading event theme:', error);
      } finally {
        setLoading(false);
      }
    };

    loadEventTheme();
  }, [eventId]);

  const applyThemeToDOM = (themeData) => {
    const root = document.documentElement;
    
    // Apply CSS custom properties
    root.style.setProperty('--primary-color', themeData.primaryColor || theme.primaryColor);
    root.style.setProperty('--secondary-color', themeData.secondaryColor || theme.secondaryColor);
    root.style.setProperty('--accent-color', themeData.accentColor || theme.accentColor);
    root.style.setProperty('--background-color', themeData.backgroundColor || theme.backgroundColor);
    root.style.setProperty('--text-color', themeData.textColor || theme.textColor);
    root.style.setProperty('--card-background', themeData.cardBackground || theme.cardBackground);
    root.style.setProperty('--border-color', themeData.borderColor || theme.borderColor);
    root.style.setProperty('--border-radius', themeData.borderRadius || theme.borderRadius);
    
    // Apply font family if specified
    if (themeData.brandFont) {
      root.style.setProperty('--brand-font', themeData.brandFont);
    }
  };

  // UI Theme functions
  const toggleTheme = () => {
    const themes = ['light', 'dark', 'system'];
    const currentIndex = themes.indexOf(uiTheme);
    const nextIndex = (currentIndex + 1) % themes.length;
    setUITheme(themes[nextIndex]);
  };

  const setThemeMode = (mode) => {
    if (['light', 'dark', 'system'].includes(mode)) {
      setUITheme(mode);
    }
  };

  // Event-specific theme functions (existing)
  const updateTheme = (newTheme) => {
    const updatedTheme = { ...theme, ...newTheme };
    setTheme(updatedTheme);
    applyThemeToDOM(updatedTheme);
  };

  const resetTheme = () => {
    const defaultTheme = {
      primaryColor: '#8B5CF6', // Updated to purple
      secondaryColor: '#3B82F6',
      accentColor: '#F59E0B',
      backgroundColor: '#F8FAFC',
      textColor: '#1F2937',
      cardBackground: '#FFFFFF',
      borderColor: '#E5E7EB',
      brandFont: 'Inter',
      borderRadius: '0.5rem',
      shadowIntensity: 'medium'
    };
    setTheme(defaultTheme);
    applyThemeToDOM(defaultTheme);
  };

  const value = {
    // UI Theme
    uiTheme,
    resolvedTheme,
    toggleTheme,
    setThemeMode,
    
    // Event-specific theme (existing)
    theme,
    updateTheme,
    resetTheme,
    loading,
    applyThemeToDOM
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

export default ThemeContext; 