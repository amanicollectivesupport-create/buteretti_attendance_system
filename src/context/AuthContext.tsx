import React, { createContext, useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { supabase, isSupabaseReal } from '../lib/supabaseClient';
import { Profile, UserRole } from '../types';
import { User } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  role: UserRole | null;
  mustChangePassword: boolean | undefined;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const handleConnectionError = (errorMsg: string = '') => {
    if (isSupabaseReal()) {
      console.warn('Supabase fetch connection failed:', errorMsg);
      localStorage.setItem('force_demo_mode', 'true');
      toast.error('Supabase connection failed. Falling back to robust Local Database Demo mode...', { duration: 5000 });
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    }
  };

  const isNetworkFailure = (msg: string) => {
    const m = String(msg).toLowerCase();
    return m.includes('failed to fetch') || m.includes('networkerror') || m.includes('fetch');
  };

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Error fetching profile:', error.message);
        if (isNetworkFailure(error.message)) {
          handleConnectionError(error.message);
          return;
        }
        setProfile(null);
        setRole(null);
        toast.error("Profile not found. Contact system administrator.");
      } else if (!data) {
        setProfile(null);
        setRole(null);
        toast.error("Profile not found. Contact system administrator.");
      } else {
        setProfile(data as Profile);
        setRole((data as Profile).role);
      }
    } catch (err: any) {
      console.error('Unexpected error fetching profile:', err);
      const errMsg = err?.message || String(err);
      if (isNetworkFailure(errMsg)) {
        handleConnectionError(errMsg);
        return;
      }
      setProfile(null);
      setRole(null);
      toast.error("Profile not found. Contact system administrator.");
    }
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.id);
    }
  };

  const signOut = async () => {
    setLoading(true);
    try {
      await supabase.auth.signOut();
      setUser(null);
      setProfile(null);
      setRole(null);
      navigate('/login', { replace: true });
    } catch (err) {
      console.error('Error signing out:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // 1. Get initial session
    const initAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession() as any;
        if (error && isNetworkFailure(error.message)) {
          handleConnectionError(error.message);
          return;
        }
        if (session?.user) {
          setUser(session.user);
          await fetchProfile(session.user.id);
        } else {
          setUser(null);
          setProfile(null);
          setRole(null);
        }
      } catch (err: any) {
        console.error('Error checking auth session:', err);
        const errMsg = err?.message || String(err);
        if (isNetworkFailure(errMsg)) {
          handleConnectionError(errMsg);
          return;
        }
      } finally {
        setLoading(false);
      }
    };

    initAuth();

    // 2. Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      setLoading(true);
      if (session?.user) {
        setUser(session.user);
        await fetchProfile(session.user.id);
      } else {
        setUser(null);
        setProfile(null);
        setRole(null);
      }
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, profile, role, mustChangePassword: profile?.must_change_password, loading, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
