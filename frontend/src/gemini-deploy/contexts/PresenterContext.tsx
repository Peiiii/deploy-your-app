/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext } from 'react';
import type { Presenter } from '../presenter';
import { presenter as globalPresenter } from '../presenter';

const PresenterContext = createContext<Presenter>(globalPresenter);

export const PresenterProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <PresenterContext.Provider value={globalPresenter}>
      {children}
    </PresenterContext.Provider>
  );
};

export const usePresenter = () => useContext(PresenterContext);
