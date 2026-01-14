import { APP_CONFIG } from '@/constants';

const API_BASE = APP_CONFIG.API_BASE_URL.replace(/\/+$/, '');

export type CloudDbPermissionMode =
  | 'creator_read_write'
  | 'all_read_creator_write'
  | 'all_read_readonly'
  | 'none';

export async function getProjectCloudDbCollectionPermission(input: {
  projectId: string;
  collection: string;
}): Promise<{ projectId: string; appId: string; collection: string; mode: CloudDbPermissionMode; updatedAt: number | null }> {
  const res = await fetch(
    `${API_BASE}/projects/${encodeURIComponent(input.projectId)}/cloud/db/collections/${encodeURIComponent(input.collection)}/permission`,
    { method: 'GET', credentials: 'include' },
  );
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error || 'Failed to load Cloud DB permission');
  }
  return (await res.json()) as {
    projectId: string;
    appId: string;
    collection: string;
    mode: CloudDbPermissionMode;
    updatedAt: number | null;
  };
}

export async function setProjectCloudDbCollectionPermission(input: {
  projectId: string;
  collection: string;
  mode: CloudDbPermissionMode;
}): Promise<{ projectId: string; appId: string; collection: string; mode: CloudDbPermissionMode; updatedAt: number }> {
  const res = await fetch(
    `${API_BASE}/projects/${encodeURIComponent(input.projectId)}/cloud/db/collections/${encodeURIComponent(input.collection)}/permission`,
    {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: input.mode }),
    },
  );
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error || 'Failed to save Cloud DB permission');
  }
  return (await res.json()) as {
    projectId: string;
    appId: string;
    collection: string;
    mode: CloudDbPermissionMode;
    updatedAt: number;
  };
}

export async function resetProjectCloudDbCollectionPermission(input: {
  projectId: string;
  collection: string;
}): Promise<void> {
  const res = await fetch(
    `${API_BASE}/projects/${encodeURIComponent(input.projectId)}/cloud/db/collections/${encodeURIComponent(input.collection)}/permission`,
    { method: 'DELETE', credentials: 'include' },
  );
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error || 'Failed to reset Cloud DB permission');
  }
}

export type SecurityRulesV0 = {
  version: 0;
  read: { allOf: Array<{ field: string; op: '=='; value: unknown }> } | { anyOf: Array<{ allOf: Array<{ field: string; op: '=='; value: unknown }> }> };
  write: { allOf: Array<{ field: string; op: '=='; value: unknown }> } | { anyOf: Array<{ allOf: Array<{ field: string; op: '=='; value: unknown }> }> };
};

export async function getProjectCloudDbCollectionSecurityRules(input: {
  projectId: string;
  collection: string;
}): Promise<{ projectId: string; appId: string; collection: string; rules: SecurityRulesV0 | null; updatedAt: number | null }> {
  const res = await fetch(
    `${API_BASE}/projects/${encodeURIComponent(input.projectId)}/cloud/db/collections/${encodeURIComponent(input.collection)}/security-rules`,
    { method: 'GET', credentials: 'include' },
  );
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error || 'Failed to load Cloud DB security rules');
  }
  return (await res.json()) as {
    projectId: string;
    appId: string;
    collection: string;
    rules: SecurityRulesV0 | null;
    updatedAt: number | null;
  };
}

export async function setProjectCloudDbCollectionSecurityRules(input: {
  projectId: string;
  collection: string;
  rules: SecurityRulesV0;
}): Promise<{ projectId: string; appId: string; collection: string; rules: SecurityRulesV0; updatedAt: number }> {
  const res = await fetch(
    `${API_BASE}/projects/${encodeURIComponent(input.projectId)}/cloud/db/collections/${encodeURIComponent(input.collection)}/security-rules`,
    {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rules: input.rules }),
    },
  );
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error || 'Failed to save Cloud DB security rules');
  }
  return (await res.json()) as {
    projectId: string;
    appId: string;
    collection: string;
    rules: SecurityRulesV0;
    updatedAt: number;
  };
}

export async function deleteProjectCloudDbCollectionSecurityRules(input: {
  projectId: string;
  collection: string;
}): Promise<void> {
  const res = await fetch(
    `${API_BASE}/projects/${encodeURIComponent(input.projectId)}/cloud/db/collections/${encodeURIComponent(input.collection)}/security-rules`,
    { method: 'DELETE', credentials: 'include' },
  );
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error || 'Failed to delete Cloud DB security rules');
  }
}

