import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase environment variables');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    console.log('🚀 Starting daily payment check...', new Date().toISOString());

    // Step 1: Create/update payment reminders
    console.log('📋 Creating payment reminders...');
    const { data: remindersCreated, error: remindersError } = await supabase
      .rpc('create_payment_reminders');

    if (remindersError) {
      console.error('❌ Error creating reminders:', remindersError);
      throw new Error(`Failed to create reminders: ${remindersError.message}`);
    }

    console.log('✅ Reminders created/updated:', remindersCreated);

    // Step 2: Auto-exclude students with 30+ days overdue
    console.log('🚫 Checking for students to exclude...');
    const { data: studentsExcluded, error: excludeError } = await supabase
      .rpc('auto_exclude_students');

    if (excludeError) {
      console.error('❌ Error excluding students:', excludeError);
      throw new Error(`Failed to exclude students: ${excludeError.message}`);
    }

    console.log('✅ Students excluded:', studentsExcluded);

    // Step 3: Get active reminders for notification sending
    console.log('📧 Preparing notifications...');
    const { data: activeReminders, error: notifError } = await supabase
      .from('active_payment_reminders')
      .select('*')
      .eq('notification_sent', false)
      .limit(100);

    if (notifError) {
      console.error('❌ Error fetching notifications:', notifError);
      throw new Error(`Failed to fetch notifications: ${notifError.message}`);
    }

    // Count notifications by level
    const notificationsByLevel = {
      level1: activeReminders?.filter(r => r.reminder_level === 1).length || 0,
      level2: activeReminders?.filter(r => r.reminder_level === 2).length || 0,
      level3: activeReminders?.filter(r => r.reminder_level === 3).length || 0,
    };

    console.log('📬 Notifications ready to send:', activeReminders?.length || 0);
    console.log('  - Level 1 (1-14 days):', notificationsByLevel.level1);
    console.log('  - Level 2 (15-29 days):', notificationsByLevel.level2);
    console.log('  - Level 3 (30+ days):', notificationsByLevel.level3);

    // Step 4: Get overall statistics
    const { data: stats, error: statsError } = await supabase
      .from('payment_reminders')
      .select('reminder_level, status')
      .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

    let totalActive = 0;
    let totalPaid = 0;
    let totalCancelled = 0;

    if (stats && !statsError) {
      totalActive = stats.filter(s => s.status === 'active').length;
      totalPaid = stats.filter(s => s.status === 'paid').length;
      totalCancelled = stats.filter(s => s.status === 'cancelled').length;
    }

    console.log('✅ Daily payment check completed successfully');

    // Return comprehensive response
    return new Response(JSON.stringify({
      success: true,
      timestamp: new Date().toISOString(),
      remindersCreated: remindersCreated || 0,
      studentsExcluded: studentsExcluded || 0,
      notificationsSent: activeReminders?.length || 0,
      details: {
        reminders: {
          created: remindersCreated || 0,
          message: `${remindersCreated || 0} payment reminders processed`
        },
        exclusions: {
          excluded: studentsExcluded || 0,
          message: studentsExcluded > 0 
            ? `${studentsExcluded} student(s) excluded due to 30+ days overdue`
            : 'No students excluded today'
        },
        notifications: {
          ready: activeReminders?.length || 0,
          byLevel: notificationsByLevel,
          message: `${activeReminders?.length || 0} notifications ready to send`
        },
        statistics: {
          last30Days: {
            active: totalActive,
            paid: totalPaid,
            cancelled: totalCancelled
          }
        }
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('❌ Fatal error in daily payment check:', error);

    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      timestamp: new Date().toISOString(),
      details: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack
      } : undefined
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
