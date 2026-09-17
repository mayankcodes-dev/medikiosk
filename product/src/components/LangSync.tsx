"use client";
import { useEffect } from "react";

/** Syncs the <html lang> attribute with the patient's chosen language from sessionStorage */
export function LangSync() {
  useEffect(() => {
    const sync = () => {
      const lang = sessionStorage.getItem("mk_lang") || "en";
      document.documentElement.lang = lang;
    };
    sync();
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);
  return null;
}
