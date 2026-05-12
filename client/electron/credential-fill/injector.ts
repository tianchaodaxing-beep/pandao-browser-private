import type { WebContents } from 'electron';
import type { PlatformSelector } from 'shared';

export type CredentialFillInput = {
  shopId: number;
  selector: PlatformSelector;
  username: string;
  password: string;
};

export type CredentialFillResult = {
  filled: boolean;
  reason?: 'selector-miss';
};

export async function injectCredentialFields(
  webContents: WebContents,
  input: CredentialFillInput
): Promise<CredentialFillResult> {
  const source = `
(() => {
  const usernameSelector = ${JSON.stringify(input.selector.username)};
  const passwordSelector = ${JSON.stringify(input.selector.password)};
  const username = ${JSON.stringify(input.username)};
  const password = ${JSON.stringify(input.password)};
  const deadline = Date.now() + 5000;

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const setValue = (element, value) => {
    const proto = element instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLElement.prototype;
    const descriptor = Object.getOwnPropertyDescriptor(proto, 'value');
    if (descriptor && typeof descriptor.set === 'function') {
      descriptor.set.call(element, value);
    } else {
      element.value = value;
    }
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  };

  return (async () => {
    while (Date.now() < deadline) {
      const usernameInput = document.querySelector(usernameSelector);
      const passwordInput = document.querySelector(passwordSelector);
      if (usernameInput && passwordInput) {
        setValue(usernameInput, username);
        setValue(passwordInput, password);
        return { filled: true };
      }
      await sleep(100);
    }

    return { filled: false, reason: 'selector-miss' };
  })();
})();
`;

  return (await webContents.executeJavaScript(source, true)) as CredentialFillResult;
}
