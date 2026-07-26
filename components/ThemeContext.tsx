// import AsyncStorage from "@react-native-async-storage/async-storage";
// import React, { createContext, useContext, useEffect, useState } from "react";
// import { useColorScheme } from "react-native";

// type ThemeMode = "light" | "dark" | "system";

// interface ThemeContextType {
//   themeMode: ThemeMode;
//   currentTheme: "light" | "dark";
//   setThemeMode: (mode: ThemeMode) => void;
//   isDarkMode: boolean;
// }

// const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
//   const systemColorScheme = useColorScheme();
//   const [themeMode, setThemeModeState] = useState<ThemeMode>("system");

//   // Load saved theme preference on mount
//   useEffect(() => {
//     loadThemePreference();
//   }, []);

//   const loadThemePreference = async () => {
//     try {
//       const savedTheme = await AsyncStorage.getItem("themeMode");
//       if (
//         savedTheme &&
//         (savedTheme === "light" ||
//           savedTheme === "dark" ||
//           savedTheme === "system")
//       ) {
//         setThemeModeState(savedTheme as ThemeMode);
//       }
//     } catch (error) {
//       console.error("Error loading theme preference:", error);
//     }
//   };

//   const setThemeMode = async (mode: ThemeMode) => {
//     try {
//       await AsyncStorage.setItem("themeMode", mode);
//       setThemeModeState(mode);
//     } catch (error) {
//       console.error("Error saving theme preference:", error);
//     }
//   };

//   // Determine the actual theme to use
//   const currentTheme: "light" | "dark" =
//     themeMode === "system" ? systemColorScheme ?? "light" : themeMode;

//   const isDarkMode = currentTheme === "dark";

//   return (
//     <ThemeContext.Provider
//       value={{ themeMode, currentTheme, setThemeMode, isDarkMode }}
//     >
//       {children}
//     </ThemeContext.Provider>
//   );
// };

// export const useTheme = () => {
//   const context = useContext(ThemeContext);
//   if (!context) {
//     throw new Error("useTheme must be used within a ThemeProvider");
//   }
//   return context;
// };

import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useState } from "react";
import { useColorScheme } from "react-native";

type ThemeMode = "light" | "dark" | "system";

interface ThemeContextType {
  themeMode: ThemeMode;
  currentTheme: "light" | "dark";
  setThemeMode: (mode: ThemeMode) => void;
  setIsDarkMode: (isDark: boolean) => void;
  isDarkMode: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const CustomThemeProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const systemColorScheme = useColorScheme();
  const [themeMode, setThemeModeState] = useState<ThemeMode>("system");
  const [isLoaded, setIsLoaded] = useState(false);

  // Load saved theme preference on mount
  useEffect(() => {
    loadThemePreference();
  }, []);

  const loadThemePreference = async () => {
    try {
      const savedTheme = await AsyncStorage.getItem("themeMode");
      if (
        savedTheme &&
        (savedTheme === "light" ||
          savedTheme === "dark" ||
          savedTheme === "system")
      ) {
        setThemeModeState(savedTheme as ThemeMode);
      }
      setIsLoaded(true);
    } catch (error) {
      console.error("Error loading theme preference:", error);
      setIsLoaded(true);
    }
  };

  const setThemeMode = async (mode: ThemeMode) => {
    try {
      await AsyncStorage.setItem("themeMode", mode);
      setThemeModeState(mode);
    } catch (error) {
      console.error("Error saving theme preference:", error);
    }
  };

  const setIsDarkMode = (isDark: boolean) => {
    setThemeMode(isDark ? "dark" : "light");
  };

  // Determine the actual theme to use
  const currentTheme: "light" | "dark" =
    themeMode === "system" ? (systemColorScheme ?? "light") : themeMode;

  const isDarkMode = currentTheme === "dark";

  // Don't render children until theme is loaded to prevent flash
  if (!isLoaded) {
    return null;
  }

  return (
    <ThemeContext.Provider
      value={{
        themeMode,
        currentTheme,
        setThemeMode,
        setIsDarkMode,
        isDarkMode,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a CustomThemeProvider");
  }
  return context;
};
