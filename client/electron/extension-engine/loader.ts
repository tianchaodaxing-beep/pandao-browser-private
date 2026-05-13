import type { Session } from 'electron';
import type { BrowserExtension, WorkspaceExtensionsResponse } from 'shared';
import { requestAuthedJson } from '../browser-engine/api-client.js';

const loadedExtensions = new WeakMap<Session, Set<string>>();

export async function listWorkspaceExtensions(workspaceId: number): Promise<BrowserExtension[]> {
  const result = await requestAuthedJson<WorkspaceExtensionsResponse>(`/workspaces/${workspaceId}/extensions`, {
    method: 'GET'
  });
  return result.extensions;
}

export async function unloadAll(shopSession: Session) {
  const loaded = loadedExtensions.get(shopSession);
  if (!loaded) {
    return;
  }

  for (const extensionId of loaded) {
    try {
      await shopSession.removeExtension(extensionId);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.log(`[extensions] unload skipped id=${extensionId} reason=${message}`);
    }
  }

  loadedExtensions.delete(shopSession);
}

export async function loadExtensions(shopSession: Session, workspaceId: number) {
  await unloadAll(shopSession);
  const extensions = await listWorkspaceExtensions(workspaceId);
  const loaded = new Set<string>();

  for (const extension of extensions) {
    if (!extension.enabled) {
      continue;
    }

    try {
      const loadedExtension = await shopSession.loadExtension(extension.installedPath, {
        allowFileAccess: true
      });
      loaded.add(loadedExtension.id);
      console.log(`[extensions] loaded workspace=${workspaceId} extension=${extension.name}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.log(`[extensions] load failed workspace=${workspaceId} extension=${extension.id} reason=${message}`);
    }
  }

  loadedExtensions.set(shopSession, loaded);
}

export { installCrx, installFromGithub, installZip, type InstalledExtensionFiles } from './installer.js';
