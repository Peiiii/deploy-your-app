/**
 * Network API
 *
 * Proxy to host network capability with declarative RPC config.
 */

import { createRPCProxy } from '../core';
import { fallbackNetwork } from '../fallback';
import type { NetworkAPI } from '../types';

// ========== Network API ==========

export const networkAPI = createRPCProxy<NetworkAPI>(
  ['request'],
  {
    mapping: {
      request: 'networkRequest',
    },
    fallbacks: {
      request: fallbackNetwork.request,
    },
  }
);


