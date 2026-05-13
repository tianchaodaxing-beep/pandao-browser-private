import type { FingerprintConfig, WorkspacePlatform, WorkspaceStatus } from 'shared';
import { encryptPassword } from '../../utils/crypto.js';
import type { AuthUser } from '../auth/types.js';
import { generateFingerprint } from './fingerprint-generator.js';
import {
  assignWorkspaceToUser,
  createWorkspace,
  findAccessibleWorkspace,
  listAccessibleWorkspaces,
  listWorkspaceCategories,
  updateWorkspace,
  upsertWorkspaceCredential,
  type CreateWorkspaceInput,
  type UpdateWorkspaceInput
} from './repository.js';

export const workspacePlatforms = ['naver_smartstore', 'coupang', 'gmarket', '11st', 'custom', 'erp', 'tool'] as const;
export const workspaceStatuses = ['active', 'archived'] as const;

export type CreateWorkspaceForBossInput = Omit<CreateWorkspaceInput, 'fingerprintConfig'> & {
  fingerprintConfig?: FingerprintConfig | null;
};

export function isWorkspacePlatform(value: unknown): value is WorkspacePlatform {
  return typeof value === 'string' && workspacePlatforms.includes(value as WorkspacePlatform);
}

export function isWorkspaceStatus(value: unknown): value is WorkspaceStatus {
  return typeof value === 'string' && workspaceStatuses.includes(value as WorkspaceStatus);
}

export function parsePositiveInt(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export function parseSortOrder(value: unknown): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : 0;
}

export async function listWorkspacesForUser(user: AuthUser) {
  return listAccessibleWorkspaces(user);
}

export async function getWorkspaceForUser(user: AuthUser, workspaceId: number) {
  return findAccessibleWorkspace(user, workspaceId);
}

export async function listCategoriesForUser(_user: AuthUser) {
  return listWorkspaceCategories();
}

export async function createWorkspaceForBoss(input: CreateWorkspaceForBossInput) {
  return createWorkspace({
    ...input,
    fingerprintConfig: input.fingerprintConfig ?? generateFingerprint()
  });
}

export async function updateWorkspaceForBoss(workspaceId: number, input: UpdateWorkspaceInput) {
  return updateWorkspace(workspaceId, input);
}

export async function setWorkspaceCredentialForUser(
  user: AuthUser,
  workspaceId: number,
  username: string,
  plainPassword: string
) {
  const workspace = await findAccessibleWorkspace(user, workspaceId);

  if (!workspace) {
    return null;
  }

  let password: string | null = plainPassword;
  const encrypted = encryptPassword(password);
  password = null;
  void password;

  return upsertWorkspaceCredential({
    shopId: workspaceId,
    username,
    encrypted: encrypted.encrypted,
    iv: encrypted.iv,
    tag: encrypted.tag,
    updatedBy: user.id
  });
}

export async function assignWorkspaceForBoss(workspaceId: number, userId: number, grantedBy: number) {
  await assignWorkspaceToUser(workspaceId, userId, grantedBy);
}

export const shopPlatforms = workspacePlatforms;
export const isShopPlatform = isWorkspacePlatform;
export const listShopsForUser = listWorkspacesForUser;
export const getShopForUser = getWorkspaceForUser;
export const createShopForBoss = createWorkspaceForBoss;
export const setShopCredentialForUser = setWorkspaceCredentialForUser;
export const assignShopForBoss = assignWorkspaceForBoss;
export type CreateShopForBossInput = CreateWorkspaceForBossInput;
