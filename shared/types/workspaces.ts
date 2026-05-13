import type { FingerprintConfig } from './fingerprint.js';

export type WorkspacePlatform =
  | 'naver_smartstore'
  | 'coupang'
  | 'gmarket'
  | '11st'
  | 'custom'
  | 'erp'
  | 'tool';

export type WorkspaceStatus = 'active' | 'archived';

export type Workspace = {
  id: number;
  name: string;
  platform: WorkspacePlatform;
  category: string | null;
  icon: string | null;
  sortOrder: number;
  teamId: number | null;
  defaultUrl: string | null;
  proxyId: number | null;
  fingerprintConfig: FingerprintConfig | null;
  status: WorkspaceStatus;
  createdAt: string;
};

export type WorkspaceCredentialInput = {
  username: string;
  password: string;
};

export type LockStatusResponse = {
  locked: boolean;
};

export type UnlockResponse = LockStatusResponse;

export type WorkspaceAssignmentInput = {
  userId: number;
  workspaceId?: number;
  shopId?: number;
};

export type WorkspaceListResponse = {
  workspaces: Workspace[];
};

export type WorkspaceCategoriesResponse = {
  categories: string[];
};

export type WorkspaceActivateRequest = {
  workspaceId: number;
};

export type WorkspaceActivateResponse = {
  ok: true;
};

export type WorkspaceDetachRequest = {
  workspaceId: number;
};

export type WorkspaceDetachResponse = {
  ok: true;
};

export type WorkspaceViewBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type WorkspaceCreateRequest = {
  name: string;
  platform: WorkspacePlatform;
  defaultUrl?: string | null;
  teamId?: number | null;
  category?: string | null;
  icon?: string | null;
  sortOrder?: number | null;
};

export type WorkspaceUpdateRequest = Partial<WorkspaceCreateRequest> & {
  status?: WorkspaceStatus;
};

export type WorkspaceCreateResponse = {
  workspace: Workspace;
};

export type WorkspaceUpdateResponse = {
  workspace: Workspace;
};

export type ExtensionSourceType = 'crx' | 'zip' | 'github' | 'manual';

export type BrowserExtension = {
  id: string;
  name: string;
  version: string | null;
  sourceType: ExtensionSourceType;
  sourceUrl: string | null;
  installedPath: string;
  enabled: boolean;
  installedAt: string;
};

export type ExtensionListResponse = {
  extensions: BrowserExtension[];
};

export type ExtensionInstallRequest = {
  sourceType: ExtensionSourceType;
  sourceUrl?: string | null;
  name?: string | null;
};

export type ExtensionInstallResponse = {
  extension: BrowserExtension;
};

export type ExtensionToggleRequest = {
  enabled: boolean;
};

export type ExtensionBindRequest = {
  extensionId: string;
};

export type WorkspaceExtensionsResponse = {
  extensions: BrowserExtension[];
};

export type WorkspaceExtensionBindResponse = {
  ok: true;
};

export type ShopPlatform = WorkspacePlatform;
export type ShopStatus = WorkspaceStatus;
export type Shop = Workspace;
export type ShopCredentialInput = WorkspaceCredentialInput;
export type ShopAssignmentInput = WorkspaceAssignmentInput;
export type ShopListResponse = {
  shops: Shop[];
};
export type ShopOpenRequest = {
  shopId: number;
};
export type ShopOpenResponse = WorkspaceActivateResponse;
export type ShopCloseRequest = {
  shopId: number;
};
export type ShopCreateRequest = WorkspaceCreateRequest;
export type ShopCreateResponse = {
  shop: Shop;
};
