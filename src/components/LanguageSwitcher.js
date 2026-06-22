import React from "react";
import { useTranslation } from "react-i18next";

const LanguageSwitcher = () => {
  const { i18n } = useTranslation();

  const toggleLang = () => {
    const next = i18n.language === "af" ? "en" : "af";
    i18n.changeLanguage(next);
    localStorage.setItem("i18nextLng", next);
  };

  return (
    <button
      onClick={toggleLang}
      style={{
        background: "transparent",
        border: "1px solid var(--border-input, #cbd5e1)",
        borderRadius: 6,
        padding: "4px 10px",
        fontSize: 12,
        fontWeight: 600,
        cursor: "pointer",
        color: "#fff",
        minHeight: 32,
      }}
      aria-label={`Switch language to ${i18n.language === "af" ? "English" : "Afrikaans"}`}
    >
      {i18n.language === "af" ? "EN" : "AF"}
    </button>
  );
};

export default LanguageSwitcher;
