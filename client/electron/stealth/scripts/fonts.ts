export function buildFontsScript() {
  return `
  if (document.fonts && document.fonts.check) {
    const configuredFonts = fp.fonts.map((font) => font.toLowerCase());
    document.fonts.check = function (spec) {
      const normalized = String(spec).toLowerCase();
      return configuredFonts.some((font) => normalized.includes(font));
    };
  }
`;
}
