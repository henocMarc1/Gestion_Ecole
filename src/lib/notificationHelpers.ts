// Helper function for creating system notifications
import { supabase } from '@/lib/supabase';

export interface NotificationPayload {
  title: string;
  message: string;
  notification_type: 'info' | 'alert' | 'reminder' | 'announcement' | 'urgent';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  target_type: 'all' | 'parents' | 'employees' | 'teachers' | 'class' | 'custom';
  school_id: string;
  target_class_id?: string | null;
  target_user_ids?: string[]; // Pour ciblage custom
  scheduled_at?: string | null;
  metadata?: Record<string, any>;
}

export async function createNotification(payload: NotificationPayload) {
  try {
    const notificationData = {
      school_id: payload.school_id,
      title: payload.title,
      message: payload.message,
      notification_type: payload.notification_type,
      priority: payload.priority,
      target_type: payload.target_type,
      target_class_id: payload.target_class_id || null,
      scheduled_at: payload.scheduled_at || null,
      status: payload.scheduled_at ? 'scheduled' : 'sent',
      sent_at: payload.scheduled_at ? null : new Date().toISOString(),
    };

    const { data: notification, error } = await supabase
      .from('notifications')
      .insert(notificationData)
      .select()
      .single();

    if (error) {
      console.error('Error creating notification:', error);
      return null;
    }

    // If custom targeting, create recipients
    if (
      payload.target_type === 'custom' &&
      payload.target_user_ids &&
      payload.target_user_ids.length > 0 &&
      notification
    ) {
      const recipients = payload.target_user_ids.map((userId) => ({
        notification_id: notification.id,
        user_id: userId,
        status: 'unread',
        read_at: null,
        created_at: new Date().toISOString(),
      }));

      await supabase.from('notification_recipients').insert(recipients);
    }

    return notification;
  } catch (error) {
    console.error('Error in createNotification:', error);
    return null;
  }
}

export async function notifyNewUser(
  schoolId: string,
  userName: string,
  userRole: string,
  userId: string
) {
  // Notify all admins and staff about new user creation
  const { data: admins } = await supabase
    .from('users')
    .select('id')
    .eq('school_id', schoolId)
    .eq('role', 'ADMIN');

  const adminIds = admins?.map((a) => a.id) || [];

  if (adminIds.length > 0) {
    await createNotification({
      title: `Nouvel ${userRole}`,
      message: `${userName} a été enregistré(e) en tant que ${userRole}`,
      notification_type: 'info',
      priority: 'normal',
      target_type: 'custom',
      school_id: schoolId,
      target_user_ids: adminIds,
      metadata: { action: 'user_created', userId, userRole },
    });
  }
}

export async function notifyNewClass(
  schoolId: string,
  className: string,
  classId: string,
  teacherIds: string[]
) {
  // Notify assigned teachers about new class
  if (teacherIds.length > 0) {
    await createNotification({
      title: `Nouvelle Classe: ${className}`,
      message: `Vous avez été assigné(e) à la classe ${className}`,
      notification_type: 'announcement',
      priority: 'high',
      target_type: 'custom',
      school_id: schoolId,
      target_user_ids: teacherIds,
      metadata: { action: 'class_created', classId },
    });
  }
}

export async function notifyNewStudent(
  schoolId: string,
  studentName: string,
  className: string,
  classId: string,
  studentId: string
) {
  // Notify class teachers about new student
  const { data: classData } = await supabase
    .from('classes')
    .select('teacher_id')
    .eq('id', classId)
    .single();

  if (classData?.teacher_id) {
    await createNotification({
      title: `Nouvel Élève: ${studentName}`,
      message: `${studentName} a été enregistré(e) en classe ${className}`,
      notification_type: 'info',
      priority: 'normal',
      target_type: 'custom',
      school_id: schoolId,
      target_user_ids: [classData.teacher_id],
      metadata: { action: 'student_created', studentId, classId },
    });
  }
}

export async function notifyPaymentReceived(
  schoolId: string,
  studentName: string,
  amount: number,
  parentIds: string[]
) {
  // Notify parents about payment received
  if (parentIds.length > 0) {
    await createNotification({
      title: 'Paiement Reçu',
      message: `Paiement de ${amount.toLocaleString('fr-FR', {
        style: 'currency',
        currency: 'XOF',
      })} enregistré pour ${studentName}`,
      notification_type: 'info',
      priority: 'normal',
      target_type: 'custom',
      school_id: schoolId,
      target_user_ids: parentIds,
      metadata: { action: 'payment_received', amount, studentName },
    });
  }
}

export async function notifyTuitionFeeCreated(
  schoolId: string,
  feeName: string,
  classId: string,
  amount: number
) {
  // Notify parents about new tuition fee
  const { data: students } = await supabase
    .from('students')
    .select('id')
    .eq('class_id', classId);

  if (!students || students.length === 0) return;

  const studentIds = students.map((s) => s.id);

  // Get parents of those students
  const { data: parentLinks } = await supabase
    .from('parents_students')
    .select('parent_id')
    .in('student_id', studentIds);

  const parentIds = parentLinks?.map((p) => p.parent_id) || [];

  if (parentIds.length > 0) {
    await createNotification({
      title: `Nouvelle Facture: ${feeName}`,
      message: `Une nouvelle facture scolaire a été ajoutée: ${feeName} (${amount.toLocaleString('fr-FR', {
        style: 'currency',
        currency: 'XOF',
      })})`,
      notification_type: 'announcement',
      priority: 'high',
      target_type: 'custom',
      school_id: schoolId,
      target_user_ids: parentIds,
      metadata: { action: 'tuition_fee_created', feeName, amount },
    });
  }
}

export async function notifyClassModified(
  schoolId: string,
  className: string,
  classId: string,
  teacherIds: string[]
) {
  // Notify teachers about class modification
  if (teacherIds.length > 0) {
    await createNotification({
      title: `Classe Modifiée: ${className}`,
      message: `La classe ${className} a été modifiée`,
      notification_type: 'info',
      priority: 'normal',
      target_type: 'custom',
      school_id: schoolId,
      target_user_ids: teacherIds,
      metadata: { action: 'class_modified', classId },
    });
  }
}
