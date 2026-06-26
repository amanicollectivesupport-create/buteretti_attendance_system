import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8'

// 1. Reusable CORS headers with allowed methods and headers for preflight
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
}

Deno.serve(async (req) => {
  // 3. Wrap the entire function in a try...catch block to guarantee CORS headers on any error
  try {
    // 2. Handle OPTIONS requests for CORS preflight
    if (req.method === 'OPTIONS') {
      return new Response('ok', { 
        status: 200, 
        headers: corsHeaders 
      })
    }

    // Only allow POST requests for this function
    if (req.method !== 'POST') {
      console.error(`Method ${req.method} not allowed`);
      return new Response(
        JSON.stringify({ error: 'Method not allowed. Only POST requests are permitted.' }),
        { 
          status: 405, 
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        }
      )
    }

    // 4. Verify that all required environment variables exist
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      console.error("Fatal Server Configuration Error: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
      return new Response(
        JSON.stringify({ 
          error: 'Internal Server Error: Missing required database configuration on the server.' 
        }),
        { 
          status: 500, 
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        }
      )
    }

    // 5. Initialize the Admin Supabase client with the service_role key
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // 6. Verify caller is authenticated
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      console.error("Authentication Error: Missing Authorization header");
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { 
          status: 401, 
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        }
      )
    }

    const token = authHeader.replace('Bearer ', '')
    if (!token) {
      console.error("Authentication Error: Token part is empty");
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Missing or invalid token format' }),
        { 
          status: 401, 
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        }
      )
    }

    const { data: { user: callerUser }, error: authError } =
      await supabaseAdmin.auth.getUser(token)

    if (authError || !callerUser) {
      console.error("Authentication Error: Failed to retrieve user from token", authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Invalid token session' }),
        { 
          status: 401, 
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        }
      )
    }

    // 7. Verify caller is an administrator
    const { data: callerProfile, error: profileFetchError } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', callerUser.id)
      .single()

    if (profileFetchError) {
      console.error(`Database Error: Failed to fetch profile for user ${callerUser.id}:`, profileFetchError);
      return new Response(
        JSON.stringify({ error: 'Forbidden: Verification of authorization failed.' }),
        { 
          status: 403, 
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        }
      )
    }

    if (callerProfile?.role !== 'admin') {
      console.error(`Forbidden Error: User ${callerUser.id} attempted to create user, but role is '${callerProfile?.role || 'none'}'`);
      return new Response(
        JSON.stringify({ error: 'Forbidden: Only administrators can create users' }),
        { 
          status: 403, 
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        }
      )
    }

    // 8. Parse and validate request JSON body
    let body;
    try {
      body = await req.json()
    } catch (parseError) {
      console.error("JSON Parse Error: Failed to parse request body:", parseError);
      return new Response(
        JSON.stringify({ error: 'Bad Request: Invalid or missing JSON body' }),
        { 
          status: 400, 
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        }
      )
    }

    const {
      email,
      password,
      full_name,
      role,
      adm_no,
      course_id,
      phone
    } = body

    // 9. Validate required fields
    if (!email || !password || !full_name || !role) {
      console.error("Validation Error: Missing required fields in body", { email: !!email, password: !!password, full_name: !!full_name, role });
      return new Response(
        JSON.stringify({ error: 'Bad Request: email, password, full_name and role are required fields.' }),
        { 
          status: 400, 
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        }
      )
    }

    // Validate allowed roles
    if (!['lecturer', 'student'].includes(role)) {
      console.error(`Validation Error: Invalid role '${role}' requested.`);
      return new Response(
        JSON.stringify({ error: 'Bad Request: Role must be either lecturer or student' }),
        { 
          status: 400, 
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        }
      )
    }

    // Lecturer validation: Ensure email is real-ish and password is at least 8 characters
    if (role === 'lecturer') {
      if (!email.includes('@') || email.trim() === '') {
        console.error(`Validation Error: Lecturer email is invalid: ${email}`);
        return new Response(
          JSON.stringify({ error: 'Bad Request: A valid email address is required for lecturer accounts.' }),
          { 
            status: 400, 
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json'
            }
          }
        )
      }
      if (password.length < 8) {
        console.error("Validation Error: Lecturer password is too short");
        return new Response(
          JSON.stringify({ error: 'Bad Request: Temporary password must be at least 8 characters.' }),
          { 
            status: 400, 
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json'
            }
          }
        )
      }
    }

    // Student validation: Must contain admission number and course identification
    if (role === 'student' && (!adm_no || !course_id)) {
      console.error("Validation Error: Student registration is missing adm_no or course_id");
      return new Response(
        JSON.stringify({ error: 'Bad Request: admission number (adm_no) and course_id are required for student accounts.' }),
        { 
          status: 400, 
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        }
      )
    }

    // 10. Create user in Supabase Auth using the admin Auth interface
    const { data: newUser, error: createError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { 
          role,
          must_change_password: role === 'lecturer' 
        }
      })

    if (createError) {
      console.error(`Auth Creation Error: Failed to register user ${email} in Auth Schema:`, createError);
      if (createError.message.includes('already registered') || createError.message.includes('already exists')) {
        return new Response(
          JSON.stringify({ error: 'Conflict: An account with this email already exists.' }),
          { 
            status: 409, 
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json'
            }
          }
        )
      }
      throw createError
    }

    const newUserId = newUser.user.id

    // 11. Insert corresponding profile row inside profiles table
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert({
        id: newUserId,
        full_name,
        role,
        adm_no: role === 'student' ? adm_no : null,
        course_id: role === 'student' ? course_id : null,
        phone: phone || null,
        auth_linked: true,
        must_change_password: role === 'lecturer'
      })

    if (profileError) {
      console.error(`Database Profile Error: Profile insertion failed for ${newUserId} (${email}). Rolling back Auth creation. Error details:`, profileError);
      
      // Rollback database transaction: Delete auth user if profile insertion failed
      const { error: rollbackError } = await supabaseAdmin.auth.admin.deleteUser(newUserId)
      if (rollbackError) {
        console.error(`Rollback Failure: Critical error deleting auth user ${newUserId} during rollback:`, rollbackError);
      } else {
        console.log(`Rollback Success: Successfully deleted auth user ${newUserId} to preserve database integrity.`);
      }

      return new Response(
        JSON.stringify({
          error: `Internal Server Error: Profile database record creation failed. The registration process has been safely rolled back.`
        }),
        { 
          status: 500, 
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        }
      )
    }

    console.log(`User registered successfully: ${full_name} (${email}), Role: ${role}, ID: ${newUserId}`);

    // 12. Success Response returning 201 Created and structured details
    return new Response(
      JSON.stringify({
        success: true,
        userId: newUserId,
        message: `${role === 'lecturer' ? 'Lecturer' : 'Student'} account created successfully.`,
        must_change_password: role === 'lecturer'
      }),
      {
        status: 201,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    )

  } catch (error) {
    // 3 & 4. Catch all uncaught exceptions, log them, and safely return structured error with CORS
    console.error("Fatal Runtime Exception inside create-user Edge Function:", error);
    return new Response(
      JSON.stringify({ error: `Internal Server Error: ${error instanceof Error ? error.message : String(error)}` }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    )
  }
})
