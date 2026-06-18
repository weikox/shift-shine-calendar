import { useState, useEffect, createContext, useContext, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

type StorageMethod = 'local' | 'cloud' | 'hybrid';

interface StorageSettings {
  storageMethod: StorageMethod;
  autoSync: boolean;
}

interface StorageMethodContextType {
  storageMethod: StorageMethod;
  autoSync: boolean;
  loading: boolean;
  updateStorageMethod: (method: StorageMethod) => Promise<void>;
  updateAutoSync: (enabled: boolean) => Promise<void>;
}

const StorageMethodContext = createContext<StorageMethodContextType | undefined>(undefined);

export function StorageMethodProvider({ children }: { children: ReactNode }) {
  const [storageMethod, setStorageMethod] = useState<StorageMethod>('local');
  const [autoSync, setAutoSync] = useState(true);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    const loadSettings = async () => {
      if (!user) {
        // Si no hay usuario, usar configuración local
        const savedMethod = localStorage.getItem('storageMethod') as StorageMethod || 'local';
        const savedAutoSync = localStorage.getItem('autoSync') === 'true';
        setStorageMethod(savedMethod);
        setAutoSync(savedAutoSync);
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('app_settings')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();

        if (error) throw error;

        if (data) {
          setStorageMethod(data.storage_method as StorageMethod);
          setAutoSync(data.auto_sync);
        } else {
          // Crear configuración por defecto para el usuario
          const { error: insertError } = await supabase
            .from('app_settings')
            .insert({
              user_id: user.id,
              storage_method: 'local',
              auto_sync: true,
            });

          if (insertError) throw insertError;
        }
      } catch (error) {
        console.error('Error loading storage settings:', error);
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, [user]);

  const updateStorageMethod = async (method: StorageMethod) => {
    setStorageMethod(method);
    localStorage.setItem('storageMethod', method);

    if (user) {
      try {
        const { error } = await supabase
          .from('app_settings')
          .upsert(
            {
              user_id: user.id,
              storage_method: method,
              auto_sync: autoSync,
            },
            {
              // En BD existe UNIQUE(user_id)
              onConflict: 'user_id',
            }
          );

        if (error) throw error;
      } catch (error) {
        console.error('Error updating storage method:', error);
      }
    }
  };

  const updateAutoSync = async (enabled: boolean) => {
    setAutoSync(enabled);
    localStorage.setItem('autoSync', String(enabled));

    if (user) {
      try {
        const { error } = await supabase
          .from('app_settings')
          .upsert(
            {
              user_id: user.id,
              storage_method: storageMethod,
              auto_sync: enabled,
            },
            {
              // En BD existe UNIQUE(user_id)
              onConflict: 'user_id',
            }
          );

        if (error) throw error;
      } catch (error) {
        console.error('Error updating auto sync:', error);
      }
    }
  };

  return (
    <StorageMethodContext.Provider value={{ 
      storageMethod, 
      autoSync, 
      loading,
      updateStorageMethod, 
      updateAutoSync 
    }}>
      {children}
    </StorageMethodContext.Provider>
  );
}

export function useStorageMethod() {
  const context = useContext(StorageMethodContext);
  if (context === undefined) {
    throw new Error("useStorageMethod must be used within a StorageMethodProvider");
  }
  return context;
}
