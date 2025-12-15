let currentResolver: ((primary: boolean) => void) | null = null;

export const confirmController = {
  setResolver: (resolver: (primary: boolean) => void): void => {
    currentResolver = resolver;
  },
  resolve: (primary: boolean): void => {
    if (currentResolver) {
      currentResolver(primary);
      currentResolver = null;
    }
  },
};

