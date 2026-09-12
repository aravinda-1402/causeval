"use client";
import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
export function ThemeToggle() {
  const [light, setLight] = useState(false);
  useEffect(() => {
    try {
      const value = localStorage.getItem("causeval-theme") === "light";
      setLight(value);
      document.documentElement.dataset.theme = value ? "light" : "dark";
    } catch {
      /* Preferences are optional. */
    }
  }, []);
  return (
    <button
      className="icon-button"
      aria-label={light ? "Switch to dark theme" : "Switch to light theme"}
      onClick={() => {
        const value = !light;
        setLight(value);
        document.documentElement.dataset.theme = value ? "light" : "dark";
        try {
          localStorage.setItem("causeval-theme", value ? "light" : "dark");
        } catch {
          /* Preferences are optional. */
        }
      }}
    >
      {light ? <Moon size={17} /> : <Sun size={17} />}
    </button>
  );
}
