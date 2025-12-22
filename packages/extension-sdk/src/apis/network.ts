/**
 * Network API
 *
 * Proxy to host network capability with declarative configuration.
 */

import { createUnifiedAPI } from '../core';
import { fallbackNetwork } from '../fallback';
import type { NetworkAPI } from '../types';

// ========== Network API ==========

export const { api: networkAPI } = createUnifiedAPI<NetworkAPI>({
  rpc: {
    methods: ['request'],
    mapping: {
      request: 'networkRequest',
    },
    fallbacks: {
      request: fallbackNetwork.request,
    },
  },
});



