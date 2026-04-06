import React, { createContext, useContext, type ReactNode } from "react";

interface StorageContextType {
  dataPath: string;
}

const StorageContext = createContext<StorageContextType | null>(null);

interface StorageProviderProps {
  children: ReactNode;
}

export const StorageProvider = ({ children }: StorageProviderProps) => {
  const dataPath = process.env.CAFE_DATA_PATH || process.cwd();

  return (
    <StorageContext.Provider
      value={{
        dataPath,
      }}
    >
      {children}
    </StorageContext.Provider>
  );
};

export const useStorage = () => {
  const context = useContext(StorageContext);
  if (!context) {
    throw new Error("useStorage must be used within a StorageProvider");
  }
  return context;
};

export default StorageContext;
