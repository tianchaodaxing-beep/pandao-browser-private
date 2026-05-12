export function buildTimezoneScript() {
  return `
  const originalResolvedOptions = Intl.DateTimeFormat.prototype.resolvedOptions;
  Object.defineProperty(Intl.DateTimeFormat.prototype, 'resolvedOptions', {
    value: function (...args) {
      const options = originalResolvedOptions.apply(this, args);
      return { ...options, timeZone: fp.timezone };
    },
    configurable: true
  });

  Date.prototype.getTimezoneOffset = function () {
    return -540;
  };
`;
}
