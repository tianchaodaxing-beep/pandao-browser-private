export function buildWebglScript() {
  return `
  const patchWebgl = (contextType) => {
    if (!contextType || !contextType.prototype || !contextType.prototype.getParameter) {
      return;
    }

    const originalGetParameter = contextType.prototype.getParameter;
    contextType.prototype.getParameter = function (parameter) {
      if (parameter === 37445) {
        return fp.webglVendor;
      }
      if (parameter === 37446) {
        return fp.webglRenderer;
      }
      return originalGetParameter.call(this, parameter);
    };
  };

  patchWebgl(window.WebGLRenderingContext);
  patchWebgl(window.WebGL2RenderingContext);
`;
}
