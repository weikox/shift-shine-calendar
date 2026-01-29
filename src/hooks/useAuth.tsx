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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    // Check for existing session and validate it
    supabase.auth.getSession().then(async ({ data: { session }, error }) => {
      if (error) {
        console.error('Session error:', error);
        // Clear invalid session from localStorage
        await supabase.auth.signOut({ scope: 'local' });
        setSession(null);
        setUser(null);
        setLoading(false);
        return;
      }
      
      if (session) {
        // Verify session is still valid by making a simple request
        const { error: verifyError } = await supabase.auth.getUser();
        if (verifyError) {
          console.error('Session invalid:', verifyError);
          // Clear invalid session
          await supabase.auth.signOut({ scope: 'local' });
          setSession(null);
          setUser(null);
          setLoading(false);
          return;
        }
      }
      
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
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
        toast({
          variant: "destructive",
          title: "Error al registrarse",
          description: error.message,
        });
      } else {
        toast({
          title: "Registro exitoso",
          description: "Bienvenido a la aplicación",
        });
      }
      
      return { error };
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
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
        toast({
          variant: "destructive",
          title: "Error al iniciar sesión",
          description: error.message,
        });
      }
      
      return { error };
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
      return { error };
    }
  };

  const signOut = async () => {
    try {
      // Usamos cierre LOCAL para evitar errores tipo "Auth session missing"
      // (que ocurren cuando el cliente no tiene refresh token válido para un logout remoto).
      const { error } = await supabase.auth.signOut({ scope: 'local' });

      // Limpiar estado siempre (aunque el SDK reporte que no había sesión)
      setSession(null);
      setUser(null);

      // Si el error es solo porque no había sesión, lo tratamos como éxito.
      const isMissingSession =
        !!error &&
        typeof error.message === 'string' &&
        error.message.toLowerCase().includes('auth session missing');

      if (error && !isMissingSession) {
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
      // Fallback best-effort
      try {
        await supabase.auth.signOut({ scope: 'local' });
      } catch {
        // ignore
      }
      setSession(null);
      setUser(null);
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
