import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing environment variables');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    console.log('🚀 Starting simple test...', new Date().toISOString());

    // Test 1: Vérifier que la table existe
    const { data: tableTest, error: tableError } = await supabase
      .from('payment_reminders')
      .select('count')
      .limit(1);

    if (tableError) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Table payment_reminders not found',
        details: tableError.message
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    // Test 2: Appeler create_payment_reminders
    const { data: remindersCreated, error: remindersError } = await supabase
      .rpc('create_payment_reminders');

    if (remindersError) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Function create_payment_reminders failed',
        details: remindersError.message
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    // Test 3: Appeler auto_exclude_students
    const { data: studentsExcluded, error: exclusionError } = await supabase
      .rpc('auto_exclude_students');

    if (exclusionError) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Function auto_exclude_students failed',
        details: exclusionError.message
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    // Test 4: Lire la vue (sans .eq pour éviter les erreurs)
    const { data: viewTest, error: viewError } = await supabase
      .from('active_payment_reminders')
      .select('id')
      .limit(1);

    if (viewError) {
      return new Response(JSON.stringify({
        success: false,
        error: 'View active_payment_reminders not accessible',
        details: viewError.message
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    // Succès !
    return new Response(JSON.stringify({
      success: true,
      timestamp: new Date().toISOString(),
      remindersCreated: remindersCreated || 0,
      studentsExcluded: studentsExcluded || 0,
      tests: {
        table: '✅ payment_reminders accessible',
        function1: '✅ create_payment_reminders works',
        function2: '✅ auto_exclude_students works',
        view: '✅ active_payment_reminders accessible'
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('❌ Fatal error:', error);

    return new Response(JSON.stringify({
      success: false,
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
