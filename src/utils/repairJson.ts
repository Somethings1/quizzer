export function fixSmartQuotes(jsonStr: string): string {
  return jsonStr
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'");
}

