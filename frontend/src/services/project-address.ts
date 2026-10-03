export interface ProjectAddressSuggestion {
  slug: string;
  domain: string;
}

export interface ProjectAddressAvailability {
  available: boolean;
  domain: string;
  suggestion?: string;
}

export class ProjectAddressError extends Error {
  constructor(public readonly code: 'ADDRESS_TAKEN' | 'INVALID_ADDRESS' | 'ADDRESS_LOCKED') {
    super(code);
    this.name = 'ProjectAddressError';
  }
}
