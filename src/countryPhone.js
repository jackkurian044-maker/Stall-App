export const COUNTRY_OPTIONS = [
  { code: "IN", dialCode: "91", name: "India" },
  { code: "AE", dialCode: "971", name: "United Arab Emirates" },
];

export function normalizePhoneForCountry(phone, countryCode = "IN") {
  const digits = String(phone || "").replace(/\D/g, "");
  if (!digits) return "";
  const country = COUNTRY_OPTIONS.find((c) => c.code === countryCode) || COUNTRY_OPTIONS[0];
  const dial = country.dialCode;
  if (digits.startsWith("00971")) return digits.slice(2);
  if (digits.startsWith("971")) return digits;
  if (digits.startsWith("0091")) return digits.slice(2);
  if (digits.startsWith("91")) return digits;
  const local = digits.replace(/^0+/, "");
  return dial + local;
}

export function countryFromGooglePlace(place) {
  const country = (place?.address_components || []).find((part) => part.types?.includes("country"));
  const code = String(country?.short_name || "").toUpperCase();
  return COUNTRY_OPTIONS.some((c) => c.code === code) ? code : "IN";
}
