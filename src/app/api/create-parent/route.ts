import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

function generateDefaultPassword() {
  return `Parent${Math.random().toString(36).slice(-8)}!`;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const fullName: string | undefined = body?.fullName;
    const email: string | undefined = body?.email;
    const phone: string | undefined = body?.phone;
    const address: string | undefined = body?.address;
    const schoolId: string | undefined = body?.schoolId;

    if (!fullName || !email || !schoolId || !phone) {
      return NextResponse.json({ error: 'Nom, email, téléphone et école sont requis' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    // Vérifier si un parent existe déjà pour cet email dans l'école
    const { data: existingParents, error: existingError } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', email.toLowerCase())
      .eq('school_id', schoolId)
      .eq('role', 'PARENT')
      .is('deleted_at', null);

    if (existingError) {
      throw existingError;
    }

    if (existingParents && existingParents.length > 0) {
      return NextResponse.json({ error: 'Un parent avec cet email existe déjà' }, { status: 409 });
    }

    const defaultPassword = generateDefaultPassword();

    // Créer le compte Auth avec le rôle PARENT
    const normalizedEmail = email.toLowerCase();

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: normalizedEmail,
      password: defaultPassword,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        role: 'PARENT',
        school_id: schoolId,
      },
    });

    if (authError) {
      throw authError;
    }

    const authUser = authData.user;

    if (!authUser) {
      throw new Error('Création du compte parent échouée');
    }

    const { data: parent, error: parentError } = await supabaseAdmin
      .from('users')
      .insert({
        id: authUser.id,
        full_name: fullName,
        email: email.toLowerCase(),
        phone: phone || null,
        address: address || null,
        role: 'PARENT',
        school_id: schoolId,
        is_active: true,
        must_change_password: true,
      })
      .select()
      .single();

    if (parentError) {
      throw parentError;
    }

    return NextResponse.json({ parent, defaultPassword }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating parent:', error);
    if (error?.status === 422 || error?.message?.includes('registered')) {
      return NextResponse.json({ error: 'Un compte existe déjà avec cet email' }, { status: 409 });
    }
    return NextResponse.json({ error: error?.message || 'Erreur lors de la création du parent' }, { status: 500 });
  }
}
