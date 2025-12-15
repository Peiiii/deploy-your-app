import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Crisp } from 'crisp-sdk-web';

const CRISP_WEBSITE_ID = import.meta.env.VITE_CRISP_WEBSITE_ID;

const hiddenRoutes: string[] = [];

export const CrispChat = () => {
  const location = useLocation();

  useEffect(() => {
    if (!CRISP_WEBSITE_ID) {
      console.warn('Crisp Website ID is not configured. Please set VITE_CRISP_WEBSITE_ID in your environment variables.');
      return;
    }

    Crisp.configure(CRISP_WEBSITE_ID);

    if (hiddenRoutes.includes(location.pathname)) {
      Crisp.chat.hide();
    } else {
      Crisp.chat.show();
    }
  }, [location.pathname]);

  return null;
};

