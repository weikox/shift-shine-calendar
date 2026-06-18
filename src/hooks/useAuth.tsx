import { useState, useEffect, createContext, useContext, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User, Session } from "@supabase/supabase-js";
import { useToast } from "@/hooks/use-toast";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string) => Promise<{ error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Helper to detect network/connectivity errors
const isNetworkError = (error: any): boolean => {
  if (!error) return false;
  const message = error.message?.toLowerCase() || '';
  return (
    message.includes('failed to fetch') ||
    message.includes('network') ||
    message.includes('fetch') ||
    error.name === 'TypeError'
  );
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    let mounted = true;

    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!mounted) return;
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    // Check for existing session
    const initSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (!mounted) return;
        
        if (error) {
          // Network errors - don't clear session, just set loading false
          if (isNetworkError(error)) {
            console.warn('Network error checking session, will retry on next action');
            setLoading(false);
            return;
          }
          
          console.error('Session error:', error);
          // Clear invalid session from localStorage silently
          try {
            await supabase.auth.signOut({ scope: 'local' });
          } catch {
            // Ignore signout errors
          }
          setSession(null);
          setUser(null);
          setLoading(false);
          return;
        }
        
        if (session) {
          // Verify session is still valid
          const { error: verifyError } = await supabase.auth.getUser();
          if (verifyError) {
            // Network errors - keep existing session, don't clear
            if (isNetworkError(verifyError)) {
              console.warn('Network error verifying session');
              setSession(session);
              setUser(session.user);
              setLoading(false);
              return;
            }
            
            console.error('Session invalid:', verifyError);
            try {
              await supabase.auth.signOut({ scope: 'local' });
            } catch {
              // Ignore signout errors
            }
            setSession(null);
            setUser(null);
            setLoading(false);
            return;
          }
        }
        
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      } catch (e: any) {
        if (!mounted) return;
        // Network error during init - don't show error, just set loading false
        if (isNetworkError(e)) {
          console.warn('Network error during auth init');
        } else {
          console.error('Auth init error:', e);
        }
        setLoading(false);
      }
    };

    initSession();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signUp = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/`
        }
      });
      
      if (error) {
        const errorMessage = isNetworkError(error)
          ? "Error de conexión. Verifica tu conexión a internet e inténtalo de nuevo."
          : error.message;
          
        toast({
          variant: "destructive",
          title: "Error al registrarse",
          description: errorMessage,
        });
      } else {
        toast({
          title: "Registro exitoso",
          description: "Bienvenido a la aplicación",
        });
      }
      
      return { error };
    } catch (error: any) {
      const errorMessage = isNetworkError(error)
        ? "Error de conexión. Verifica tu conexión a internet e inténtalo de nuevo."
        : error.message;
        
      toast({
        variant: "destructive",
        title: "Error",
        description: errorMessage,
      });
      return { error };
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (error) {
        const errorMessage = isNetworkError(error)
          ? "Error de conexión. Verifica tu conexión a internet e inténtalo de nuevo."
          : error.message;
          
        toast({
          variant: "destructive",
          title: "Error al iniciar sesión",
          description: errorMessage,
        });
      }
      
      return { error };
    } catch (error: any) {
      const errorMessage = isNetworkError(error)
        ? "Error de conexión. Verifica tu conexión a internet e inténtalo de nuevo."
        : error.message;
        
      toast({
        variant: "destructive",
        title: "Error",
        description: errorMessage,
      });
      return { error };
    }
  };

  const signOut = async () => {
    try {
      // Local signout to avoid remote token issues
      const { error } = await supabase.auth.signOut({ scope: 'local' });

      // Always clear local state
      setSession(null);
      setUser(null);

      // Ignore "session missing" errors - treat as success
      const isMissingSession =
        !!error &&
        typeof error.message === 'string' &&
        error.message.toLowerCase().includes('auth session missing');

      // Ignore network errors during signout - we already cleared local state
      if (error && !isMissingSession && !isNetworkError(error)) {
        toast({
          variant: "destructive",
          title: "Error al cerrar sesión",
          description: error.message,
        });
        return;
      }

      toast({
        title: "Sesión cerrada",
        description: "Has cerrado sesión correctamente",
      });
    } catch (e: any) {
      // Fallback - clear local state regardless
      setSession(null);
      setUser(null);
      
      // Show toast only if not a network error
      if (!isNetworkError(e)) {
        toast({
          title: "Sesión cerrada",
          description: "Has cerrado sesión localmente",
        });
      } else {
        toast({
          title: "Sesión cerrada",
          description: "Has cerrado sesión correctamente",
        });
      }
    }
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
