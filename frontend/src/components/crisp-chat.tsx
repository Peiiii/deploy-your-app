import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { Crisp } from 'crisp-sdk-web';

const CRISP_WEBSITE_ID = import.meta.env.VITE_CRISP_WEBSITE_ID;

export const CrispChat = () => {
  const location = useLocation();
  const configuredRef = useRef(false);

  useEffect(() => {
    if (!CRISP_WEBSITE_ID) {
      console.warn('Crisp Website ID is not configured. Please set VITE_CRISP_WEBSITE_ID in your environment variables.');
      return;
    }

    if (!configuredRef.current) {
      Crisp.configure(CRISP_WEBSITE_ID);
      configuredRef.current = true;
    }

    // Product decision: don't show the default floating bubble.
    // The app can still open the chat explicitly (e.g. Help button).
    Crisp.chat.hide();
  }, [location.pathname]);

  return null;
};
