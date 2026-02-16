/**
 * Types TypeScript pour le système de gestion d'école
 * Générés à partir du schéma PostgreSQL/Supabase
 */

// =====================================================
// ENUMS
// =====================================================

export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  ADMIN = 'ADMIN',
  SECRETARY = 'SECRETARY',
  ACCOUNTANT = 'ACCOUNTANT',
  TEACHER = 'TEACHER',
  PARENT = 'PARENT',
}

export enum StudentStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  GRADUATED = 'GRADUATED',
  TRANSFERRED = 'TRANSFERRED',
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED',
}

export enum InvoiceStatus {
  DRAFT = 'DRAFT',
  SENT = 'SENT',
  PAID = 'PAID',
  OVERDUE = 'OVERDUE',
  CANCELLED = 'CANCELLED',
}

export enum AttendanceStatus {
  PRESENT = 'PRESENT',
  ABSENT = 'ABSENT',
  LATE = 'LATE',
  EXCUSED = 'EXCUSED',
}

export enum MessageStatus {
  DRAFT = 'DRAFT',
  SENT = 'SENT',
  READ = 'READ',
}

export enum FeeType {
  TUITION = 'TUITION',
  REGISTRATION = 'REGISTRATION',
  UNIFORM = 'UNIFORM',
  BOOKS = 'BOOKS',
  TRANSPORT = 'TRANSPORT',
  MEAL = 'MEAL',
  ACTIVITY = 'ACTIVITY',
  OTHER = 'OTHER',
}

// =====================================================
// DATABASE TABLES
// =====================================================

export interface School {
  id: string;
  name: string;
  code: string;
  address?: string;
  phone?: string;
  email?: string;
  logo_url?: string;
  website?: string;
  is_active: boolean;
  settings: Record<string, any>;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

export interface User {
  id: string;
  school_id?: string;
  email: string;
  full_name: string;
  role: UserRole;
  phone?: string;
  address?: string;
  avatar_url?: string;
  is_active: boolean;
  must_change_password: boolean;
  last_login_at?: string;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

export interface Year {
  id: string;
  school_id: string;
  name: string;
  start_date: string;
  end_date: string;
  is_current: boolean;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

export interface Class {
  id: string;
  school_id: string;
  year_id: string;
  name: string;
  level: string;
  capacity: number;
  room?: string;
  description?: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

export interface TeacherClass {
  id: string;
  teacher_id: string;
  class_id: string;
  subject?: string;
  is_main_teacher: boolean;
  created_at: string;
}

export interface Student {
  id: string;
  school_id: string;
  class_id?: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  gender: 'M' | 'F';
  registration_number?: string;
  photo_url?: string;
  place_of_birth?: string;
  nationality: string;
  blood_group?: string;
  medical_notes?: string;
  status: StudentStatus;
  enrollment_date: string;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

export interface ParentStudent {
  id: string;
  parent_id: string;
  student_id: string;
  relationship: string;
  is_primary_contact: boolean;
  can_pickup: boolean;
  emergency_contact: boolean;
  created_at: string;
}

export interface Attendance {
  id: string;
  student_id: string;
  class_id: string;
  date: string;
  status: AttendanceStatus;
  notes?: string;
  marked_by?: string;
  marked_at: string;
  created_at: string;
  updated_at: string;
}

export interface Fee {
  id: string;
  school_id: string;
  year_id: string;
  name: string;
  description?: string;
  type: FeeType;
  amount: number;
  currency: string;
  applicable_to?: string;
  due_date?: string;
  is_mandatory: boolean;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

export interface Invoice {
  id: string;
  school_id: string;
  student_id: string;
  invoice_number: string;
  issue_date: string;
  due_date: string;
  status: InvoiceStatus;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  currency: string;
  notes?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

export interface InvoiceItem {
  id: string;
  invoice_id: string;
  fee_id?: string;
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
  created_at: string;
}

export interface Payment {
  id: string;
  school_id: string;
  invoice_id: string;
  student_id: string;
  payment_number: string;
  amount: number;
  currency: string;
  payment_method: string;
  payment_date: string;
  status: PaymentStatus;
  transaction_id?: string;
  receipt_url?: string;
  notes?: string;
  received_by?: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

export interface Message {
  id: string;
  school_id: string;
  sender_id?: string;
  recipient_id: string;
  subject: string;
  body: string;
  status: MessageStatus;
  read_at?: string;
  parent_message_id?: string;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

export interface AuditLog {
  id: string;
  school_id?: string;
  user_id?: string;
  action: string;
  entity_type: string;
  entity_id?: string;
  old_values?: Record<string, any>;
  new_values?: Record<string, any>;
  ip_address?: string;
  user_agent?: string;
  metadata: Record<string, any>;
  created_at: string;
}

// =====================================================
// TYPES ÉTENDUS (avec relations)
// =====================================================

export interface StudentWithDetails extends Student {
  class?: Class;
  school?: School;
  parents?: (ParentStudent & { parent: User })[];
}

export interface ClassWithDetails extends Class {
  year?: Year;
  school?: School;
  teachers?: (TeacherClass & { teacher: User })[];
  students?: Student[];
  student_count?: number;
}

export interface InvoiceWithDetails extends Invoice {
  student?: Student;
  items?: InvoiceItem[];
  payments?: Payment[];
  total_paid?: number;
  balance?: number;
}

export interface UserWithDetails extends User {
  school?: School;
  classes?: ClassWithDetails[]; // Pour les enseignants
  children?: StudentWithDetails[]; // Pour les parents
}

// =====================================================
// TYPES POUR LES FORMULAIRES
// =====================================================

export interface CreateUserInput {
  email: string;
  full_name: string;
  role: UserRole;
  school_id?: string;
  phone?: string;
  address?: string;
  must_change_password?: boolean;
}

export interface CreateStudentInput {
  school_id: string;
  class_id?: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  gender: 'M' | 'F';
  place_of_birth?: string;
  nationality?: string;
  blood_group?: string;
  medical_notes?: string;
}

export interface CreateInvoiceInput {
  student_id: string;
  due_date: string;
  items: {
    fee_id?: string;
    description: string;
    quantity: number;
    unit_price: number;
  }[];
  discount?: number;
  tax?: number;
  notes?: string;
}

export interface CreatePaymentInput {
  invoice_id: string;
  amount: number;
  payment_method: string;
  payment_date: string;
  transaction_id?: string;
  notes?: string;
}

export interface MarkAttendanceInput {
  student_id: string;
  class_id: string;
  date: string;
  status: AttendanceStatus;
  notes?: string;
}

// =====================================================
// TYPES POUR LES RÉPONSES API
// =====================================================

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T = any> {
  data: T[];
  pagination: {
    page: number;
    per_page: number;
    total: number;
    total_pages: number;
  };
}

// =====================================================
// TYPES POUR L'AUTHENTIFICATION
// =====================================================

export interface AuthUser extends User {
  school?: School;
}

export interface AuthState {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

// =====================================================
// TYPES POUR LES STATISTIQUES
// =====================================================

export interface DashboardStats {
  total_students: number;
  total_teachers: number;
  total_classes: number;
  attendance_rate: number;
  pending_payments: number;
  total_revenue: number;
}

export interface AttendanceStats {
  date: string;
  present: number;
  absent: number;
  late: number;
  excused: number;
  total: number;
}

export interface PaymentStats {
  month: string;
  total_amount: number;
  payment_count: number;
}
