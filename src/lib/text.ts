/**
 * "License and permit renewal" -> "License And Permit Renewal": the first letter of every word is
 * capitalized and nothing else is touched, so acronyms ("PDF") and apostrophes survive. Use it on fixed
 * interface text (dropdown options, field labels); never on text a user typed.
 */
export function titleCase(text: string): string {
  return text.replace(/(^|[\s(/–-])([a-z])/g, (_, before: string, letter: string) => before + letter.toUpperCase());
}
