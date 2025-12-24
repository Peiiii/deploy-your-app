import { useMemo } from 'react';
import type { Tool } from '@agent-labs/agent-chat';

import { AGENT_TOOL_DEFS } from './definitions';
import { getToolExecutors } from './executors';

export function createGemigoTools(): Tool[] {
  const executors = getToolExecutors();
  return AGENT_TOOL_DEFS.map((def) => {
    const execute = executors[def.name];
    return { ...def, execute } satisfies Tool;
  });
}

export function useGemigoTools(): Tool[] {
  return useMemo(() => createGemigoTools(), []);
}
