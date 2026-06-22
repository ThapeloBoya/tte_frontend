// Basic input sanitizer to remove HTML tags & dangerous characters
export const sanitizeInput = (value) => {
  if (typeof value !== "string") return value;
  return value
    .replace(/<[^>]*>?/gm, "")   // remove HTML tags
    .replace(/[{}$]/g, "")        // remove curly braces or $ symbols
    .replace(/\s+/g, " ")         // collapse multiple spaces into one
};