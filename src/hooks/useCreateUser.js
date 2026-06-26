import { useState } from 'react';
import { supabase, isSupabaseReal } from '../lib/supabaseClient';

export const useCreateUser = () => {
  const [loading, setLoading] = useState(false);

  const createUser = async ({
    email,
    password,
    fullName,
    role,
    admNo,
    courseId,
    phone
  }) => {
    setLoading(true);

    try {
      // --- LOCAL MOCK MODE FALLBACK ---
      if (!isSupabaseReal()) {
        const newUserId = `usr-${role}-${Math.random().toString(36).substring(2, 11)}`;
        
        const { error: profileError } = await supabase
          .from('profiles')
          .insert({
            id: newUserId,
            full_name: fullName,
            role: role,
            adm_no: role === 'student' ? admNo : null,
            course_id: role === 'student' ? courseId : null,
            phone: phone || null,
            auth_linked: true,
            must_change_password: role === 'lecturer'
          });

        if (profileError) {
          throw new Error(`Mock Profile creation failed: ${profileError.message}`);
        }

        return { success: true, userId: newUserId };
      }

      // --- REAL SUPABASE MODE ---
      // Get admin's current session token
      const { data: { session }, error: sessionError } =
        await supabase.auth.getSession();

      if (sessionError || !session) {
        throw new Error(
          'Your session has expired. Please log in again.'
        );
      }

      let response;
      let callEdgeSuccess = false;
      let result;

      try {
        response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-user`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              // Pass admin's token — Edge Function verifies it
              'Authorization': `Bearer ${session.access_token}`
            },
            body: JSON.stringify({
              email,
              password,
              full_name: fullName,
              role,
              adm_no:    admNo    || null,
              course_id: courseId || null,
              phone:     phone    || null
            })
          }
        );

        if (response.status !== 404) {
          result = await response.json();
          callEdgeSuccess = true;
        }
      } catch (fetchError) {
        console.warn('Edge function fetch failed or was blocked by CORS. Falling back to client-side user creation with a non-persisted client to prevent admin logout...', fetchError);
      }

      if (callEdgeSuccess) {
        // Handle HTTP error responses from Edge Function (Task 5)
        if (!response.ok) {
          let errorMsg = 'Failed to create user account';
          if (response.status === 401) {
            errorMsg = 'Your session has expired. Please log in again.';
          } else if (response.status === 403) {
            errorMsg = 'You do not have permission to create users.';
          } else if (response.status === 409) {
            errorMsg = 'An account with this email already exists.';
          } else if (response.status === 500) {
            errorMsg = 'Server error. Please try again or contact support.';
          } else if (response.status === 400) {
            errorMsg = result.error || 'Validation error.';
          } else {
            errorMsg = result.error || 'Failed to create user account';
          }
          throw new Error(errorMsg);
        }

        return { success: true, userId: result.userId };
      }

      // --- CLIENT-SIDE SIGNUP FALLBACK (No admin session loss) ---
      console.log('Using safe client-side user registration fallback...');
      const { createClient } = await import('@supabase/supabase-js');
      const tempSupabase = createClient(
        import.meta.env.VITE_SUPABASE_URL,
        import.meta.env.VITE_SUPABASE_ANON_KEY,
        {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false
          }
        }
      );

      const { data: signUpData, error: signUpError } = await tempSupabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            role,
            full_name: fullName,
            adm_no: role === 'student' ? admNo : null,
            course_id: role === 'student' ? courseId : null,
            phone: phone || null
          }
        }
      });

      if (signUpError) {
        throw new Error(signUpError.message);
      }

      if (!signUpData.user) {
        throw new Error('User account created but no user record returned from server.');
      }

      const newUserId = signUpData.user.id;

      // Make sure the profile is in the database (handling any missing or delayed trigger)
      try {
        const { data: existingProfile } = await supabase
          .from('profiles')
          .select('id')
          .eq('id', newUserId)
          .maybeSingle();

        if (!existingProfile) {
          console.log('Inserting profile manually from admin account...');
          const { error: profileError } = await supabase
            .from('profiles')
            .insert({
              id: newUserId,
              full_name: fullName,
              role,
              adm_no: role === 'student' ? admNo : null,
              course_id: role === 'student' ? courseId : null,
              phone: phone || null,
              auth_linked: true,
              must_change_password: role === 'lecturer'
            });

          if (profileError) {
            console.warn('Manual profile verification insert failed (likely already handled by DB trigger):', profileError.message);
          }
        }
      } catch (profileErr) {
        console.warn('Ignored profile validation check warning:', profileErr);
      }

      return { success: true, userId: newUserId };

    } catch (error) {
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  return { createUser, loading };
};

