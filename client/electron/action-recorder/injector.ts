import type { WebContents } from 'electron';
import type { ActionSelectorEntry } from 'shared';

type InjectResult = {
  attached: boolean;
};

export async function injectActionRecorder(
  webContents: WebContents,
  shopId: number,
  selectors: ActionSelectorEntry[]
): Promise<InjectResult> {
  const script = `
    (() => {
      const selectors = ${JSON.stringify(selectors)};
      const shopId = ${JSON.stringify(shopId)};
      if (window.__pandaoActionRecorderAttached) {
        return { attached: true };
      }
      window.__pandaoActionRecorderAttached = true;

      const readFields = (fields) => {
        if (!Array.isArray(fields) || fields.length === 0) {
          return null;
        }
        const result = {};
        for (const field of fields) {
          if (!field || typeof field.name !== 'string' || typeof field.selector !== 'string') {
            continue;
          }
          if (/password|pwd|token|secret|key/i.test(field.name) || /password|pwd|token|secret|key/i.test(field.selector)) {
            continue;
          }
          const node = document.querySelector(field.selector);
          if (!node) {
            result[field.name] = null;
            continue;
          }
          result[field.name] = field.read === 'textContent' ? node.textContent : node.value ?? node.textContent;
        }
        return result;
      };

      document.addEventListener('click', (event) => {
        const target = event.target;
        if (!target || typeof target.closest !== 'function') {
          return;
        }

        for (const entry of selectors) {
          if (!entry || typeof entry.submitSelector !== 'string' || typeof entry.actionType !== 'string') {
            continue;
          }
          const matched = target.closest(entry.submitSelector);
          if (!matched) {
            continue;
          }

          const before = readFields(entry.fields);
          setTimeout(() => {
            const after = readFields(entry.fields);
            window.pandaoRecorder?.report?.({
              shopId,
              actionType: entry.actionType,
              actionPayload: {
                url: location.href,
                title: document.title
              },
              before,
              after,
              riskLevel: 'green',
              approvalStatus: 'auto'
            });
          }, 300);
          break;
        }
      }, true);

      return { attached: true };
    })();
  `;

  return webContents.executeJavaScript(script, true) as Promise<InjectResult>;
}
