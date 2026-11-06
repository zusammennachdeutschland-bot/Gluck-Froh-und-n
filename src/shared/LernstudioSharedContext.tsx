import React, { createContext, useContext, useMemo } from 'react';
import { LernstudioSet } from './types';
import { DEFAULT_LERNSTUDIO_SETS } from './defaultLernstudioSets';

export interface LernstudioAppContextType {
  lernstudioSets: LernstudioSet[];
  saveLernstudioSet: (set: LernstudioSet) => void;
  deleteLernstudioSet: (setId: string) => void;
  language: string;
  theme: 'light' | 'dark';
  groups: any[];
  students: any[];
}

const defaultContextValue: LernstudioAppContextType = {
  lernstudioSets: DEFAULT_LERNSTUDIO_SETS,
  saveLernstudioSet: () => {},
  deleteLernstudioSet: () => {},
  language: 'ar',
  theme: 'dark',
  groups: [],
  students: []
};

const LernstudioSharedContext = createContext<LernstudioAppContextType>(defaultContextValue);

export const LernstudioSharedProvider: React.FC<{
  value?: Partial<LernstudioAppContextType>;
  children: React.ReactNode;
}> = ({ value, children }) => {
  const merged = useMemo(() => ({
    ...defaultContextValue,
    ...value
  }), [value]);

  return (
    <LernstudioSharedContext.Provider value={merged}>
      {children}
    </LernstudioSharedContext.Provider>
  );
};

export const useLernstudioContext = (): LernstudioAppContextType => {
  return useContext(LernstudioSharedContext);
};
