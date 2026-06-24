/**
 * AgroInsight - i18n Configuration
 * ==================================
 * Two languages: English (en) and Kannada (kn), covering the full UI per
 * spec - navigation, forms, results, explanations, dashboards, everything.
 */

import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";

import en from "./locales/en.json";
import kn from "./locales/kn.json";

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      kn: { translation: kn },
    },
    fallbackLng: "en",
    interpolation: { escapeValue: false },
    detection: {
      order: ["localStorage", "navigator"],
      caches: ["localStorage"],
      lookupLocalStorage: "agroinsight_language",
    },
  });

export default i18n;
