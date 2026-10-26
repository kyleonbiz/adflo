/** A plausible phone number: digits with optional + prefix, brackets, spaces, dots and dashes; 7 to 15 digits. */
export function isPhone(value: string): boolean {
  if (!/^[+(]?\d[\d\s().-]*$/.test(value)) return false;
  const digits = value.replace(/\D/g, "").length;
  return digits >= 7 && digits <= 15;
}
