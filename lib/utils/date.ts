// lib/utils/date.ts
import { format } from "date-fns";
import { fr, enUS } from "date-fns/locale";

/**
 * Formate une date en string lisible
 * @param dateString - La date à formater (string, Date ou undefined)
 * @param language - La langue ('fr' ou 'en')
 * @param formatString - Le format souhaité (par défaut: 'dd MMM yyyy HH:mm')
 * @returns La date formatée ou '-' si invalide
 */
export function formatDate(
  dateString: string | Date | undefined | null,
  language: "fr" | "en" = "fr",
  formatString: string = "dd MMM yyyy HH:mm"
): string {
  if (!dateString) return "-";
  
  try {
    const date = typeof dateString === "string" ? new Date(dateString) : dateString;
    
    // Vérifier si la date est valide
    if (isNaN(date.getTime())) return "-";
    
    const locale = language === "fr" ? fr : enUS;
    return format(date, formatString, { locale });
  } catch {
    return "-";
  }
}

/**
 * Formate une date pour l'affichage court (ex: 27 mars 2026)
 */
export function formatDateShort(
  dateString: string | Date | undefined | null,
  language: "fr" | "en" = "fr"
): string {
  return formatDate(dateString, language, "dd MMM yyyy");
}

/**
 * Formate une date pour l'affichage avec l'heure (ex: 27 mars 2026, 14:30)
 */
export function formatDateTime(
  dateString: string | Date | undefined | null,
  language: "fr" | "en" = "fr"
): string {
  return formatDate(dateString, language, "dd MMM yyyy, HH:mm");
}

/**
 * Formate une date pour l'affichage de l'heure uniquement (ex: 14:30)
 */
export function formatTime(
  dateString: string | Date | undefined | null,
  language: "fr" | "en" = "fr"
): string {
  return formatDate(dateString, language, "HH:mm");
}

/**
 * Formate une date pour l'affichage relatif (ex: il y a 2 heures)
 */
export function formatRelativeDate(
  dateString: string | Date | undefined | null,
  language: "fr" | "en" = "fr"
): string {
  if (!dateString) return "-";
  
  try {
    const date = typeof dateString === "string" ? new Date(dateString) : dateString;
    if (isNaN(date.getTime())) return "-";
    
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return language === "fr" ? "À l'instant" : "Just now";
    if (diffMins < 60) return language === "fr" ? `Il y a ${diffMins} min` : `${diffMins} min ago`;
    if (diffHours < 24) return language === "fr" ? `Il y a ${diffHours} h` : `${diffHours} hours ago`;
    if (diffDays < 7) return language === "fr" ? `Il y a ${diffDays} j` : `${diffDays} days ago`;
    
    return formatDateShort(dateString, language);
  } catch {
    return "-";
  }
}