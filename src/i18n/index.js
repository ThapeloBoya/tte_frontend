import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./locales/en.json";
import af from "./locales/af.json";

const savedLang = localStorage.getItem("i18nextLng") || "en";

i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, af: { translation: af } },
  lng: savedLang,
  fallbackLng: "en",
  interpolation: { escapeValue: false },
  returnObjects: false,
});

export default i18n;
