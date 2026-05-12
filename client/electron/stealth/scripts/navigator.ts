export function buildNavigatorScript() {
  return `
  const defineNavigatorValue = (target, key, value) => {
    try {
      Object.defineProperty(target, key, {
        get: () => Array.isArray(value) ? [...value] : value,
        configurable: true
      });
    } catch {}
  };

  defineNavigatorValue(Navigator.prototype, 'userAgent', fp.userAgent);
  defineNavigatorValue(Navigator.prototype, 'platform', fp.platform);
  defineNavigatorValue(Navigator.prototype, 'language', fp.language);
  defineNavigatorValue(Navigator.prototype, 'languages', fp.languages);
  defineNavigatorValue(Navigator.prototype, 'hardwareConcurrency', fp.hardwareConcurrency);
`;
}
