export function buildScreenScript() {
  return `
  const defineScreenValue = (key, value) => {
    try {
      Object.defineProperty(window.screen, key, {
        get: () => value,
        configurable: true
      });
    } catch {}
  };

  defineScreenValue('width', fp.screenWidth);
  defineScreenValue('height', fp.screenHeight);
  defineScreenValue('availWidth', fp.screenWidth);
  defineScreenValue('availHeight', Math.max(0, fp.screenHeight - 40));
`;
}
