let supportPromise: Promise<typeof import('crisp-sdk-web')> | null = null;

export const openSupportChat = async () => {
  const websiteId = import.meta.env.VITE_CRISP_WEBSITE_ID;
  if (!websiteId) {
    window.location.assign('/community');
    return;
  }
  supportPromise ??= import('crisp-sdk-web').then((module) => {
    module.Crisp.configure(websiteId);
    return module;
  }).catch((error: unknown) => { supportPromise = null; throw error; });
  const { Crisp } = await supportPromise;
  Crisp.chat.open();
  Crisp.chat.show();
};
