import React, { createContext, useState, useContext } from 'react';

const themes = {
  light: {
    background: '#fff',
    text: '#222',
    tabBar: '#fff',
    tabBarActive: '#00C897',
    tabBarInactive: '#999',
    addButton: '#00C897',
    addButtonFocused: '#00A876',
  },
  dark: {
    background: '#181818',
    text: '#fff',
    tabBar: '#222',
    tabBarActive: '#00C897',
    tabBarInactive: '#aaa',
    addButton: '#00C897',
    addButtonFocused: '#00A876',
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