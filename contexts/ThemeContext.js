import React, { createContext, useState, useContext } from 'react';

const themes = {
  light: {
    // Base colors
    background: '#F8F9FA',
    text: '#212529',
    textSecondary: '#6C757D',
    
    // Primary colors
    primary: '#00C897',
    primaryFocused: '#00A876',
    
    // Card and surface colors
    cardBackground: '#FFFFFF',
    searchBackground: '#EEEEEE',
    
    // Status colors
    success: '#28A745',
    warning: '#FFC107',
    danger: '#DC3545',
    info: '#007BFF',
    
    // Accent colors
    orange: '#FD7E14',
    purple: '#6f42c1',
    
    // Tab bar
    tabBar: '#FFFFFF',
    tabBarActive: '#00C897',
    tabBarInactive: '#6C757D',
    
    // Buttons
    addButton: '#00C897',
    addButtonFocused: '#00A876',
    
    // Special backgrounds
    warningBackground: '#FFF6E5',
    infoBackground: '#E5F6FF',
    dangerBackground: '#FDEDED',
    
    // Icon colors
    iconDefault: '#6C757D',
    iconPrimary: '#00C897',
    iconWarning: '#FFC107',
    iconDanger: '#DC3545',
    iconInfo: '#007BFF',
  },
  dark: {
    // Base colors
    background: '#181818',
    text: '#FFFFFF',
    textSecondary: '#B0B0B0',
    
    // Primary colors
    primary: '#00C897',
    primaryFocused: '#00A876',
    
    // Card and surface colors
    cardBackground: '#2A2A2A',
    searchBackground: '#3A3A3A',
    
    // Status colors (slightly adjusted for dark mode)
    success: '#34C759',
    warning: '#FFD60A',
    danger: '#FF453A',
    info: '#30B0FF',
    
    // Accent colors
    orange: '#FF8C42',
    purple: '#8B5CF6',
    
    // Tab bar
    tabBar: '#222222',
    tabBarActive: '#00C897',
    tabBarInactive: '#AAAAAA',
    
    // Buttons
    addButton: '#00C897',
    addButtonFocused: '#00A876',
    
    // Special backgrounds (darker variants)
    warningBackground: '#2A2416',
    infoBackground: '#16242A',
    dangerBackground: '#2A1A1A',
    
    // Icon colors
    iconDefault: '#B0B0B0',
    iconPrimary: '#00C897',
    iconWarning: '#FFD60A',
    iconDanger: '#FF453A',
    iconInfo: '#30B0FF',
  },
};

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const [themeName, setThemeName] = useState('light');
  const toggleTheme = () => setThemeName((prev) => (prev === 'light' ? 'dark' : 'light'));
  const theme = themes[themeName];
  
  return (
    <ThemeContext.Provider value={{ theme, themeName, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}