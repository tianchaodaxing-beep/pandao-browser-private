import { contextBridge, ipcRenderer } from 'electron';
import type { ActionRecorderPayload } from 'shared';

contextBridge.exposeInMainWorld('pandaoRecorder', {
  report: (payload: ActionRecorderPayload) => ipcRenderer.invoke('action-recorder.report', payload)
});

export {};
