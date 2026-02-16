'use client';

import { ReactNode, useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Icons } from '@/components/ui/Icons';
import { cn } from '@/utils/helpers';
import { supabase } from '@/lib/supabase';

interface NavItem {
  label: string;
  href: string;
  icon: keyof typeof Icons;
  roles: string[];
}

const navigationItems: NavItem[] = [
  // Super Admin
  { label: 'Tableau de bord', href: '/dashboard/super-admin', icon: 'Home', roles: ['SUPER_ADMIN'] },
  { label: 'Écoles', href: '/dashboard/super-admin/schools', icon: 'Building', roles: ['SUPER_ADMIN'] },
  { label: 'Utilisateurs', href: '/dashboard/super-admin/accounts', icon: 'Users', roles: ['SUPER_ADMIN'] },
  
  // Directeur (Admin)
  { label: 'Tableau de bord', href: '/dashboard/admin', icon: 'Home', roles: ['ADMIN'] },
  { label: 'Années académiques', href: '/dashboard/admin/years', icon: 'Calendar', roles: ['ADMIN'] },
  { label: 'Classes', href: '/dashboard/admin/classes', icon: 'BookOpen', roles: ['ADMIN'] },
  { label: 'Élèves', href: '/dashboard/admin/students', icon: 'Student', roles: ['ADMIN'] },
  { label: 'Emploi du temps', href: '/dashboard/admin/timetable', icon: 'Calendar', roles: ['ADMIN'] },
  { label: 'Utilisateurs', href: '/dashboard/admin/users', icon: 'Users', roles: ['ADMIN'] },
  { label: 'Frais de scolarité', href: '/dashboard/admin/tuition-fees', icon: 'DollarSign', roles: ['ADMIN'] },
  { label: 'Rapports de collecte', href: '/dashboard/admin/tuition-reports', icon: 'BarChart', roles: ['ADMIN'] },
  { label: 'Finances', href: '/dashboard/admin/finance', icon: 'DollarSign', roles: ['ADMIN'] },
  { label: 'Notifications', href: '/dashboard/admin/notifications', icon: 'Activity', roles: ['ADMIN'] },
  { label: 'Rapports', href: '/dashboard/admin/reports', icon: 'FileText', roles: ['ADMIN'] },
  { label: 'Mes congés', href: '/dashboard/employee/leaves', icon: 'Calendar', roles: ['ADMIN'] },
  
  // RH
  { label: 'Tableau de bord', href: '/dashboard/hr', icon: 'Home', roles: ['HR'] },
  { label: 'Personnel', href: '/dashboard/hr/employees', icon: 'Users', roles: ['HR'] },
  { label: 'Pointage', href: '/dashboard/hr/attendance', icon: 'Check', roles: ['HR'] },
  { label: 'Congés (Gestion)', href: '/dashboard/hr/leaves', icon: 'Calendar', roles: ['HR'] },
  { label: 'Mes congés', href: '/dashboard/employee/leaves', icon: 'Calendar', roles: ['HR'] },
  { label: 'Emploi du temps', href: '/dashboard/hr/timetable', icon: 'Calendar', roles: ['HR'] },
  
  // Secrétaire
  { label: 'Tableau de bord', href: '/dashboard/secretary', icon: 'Home', roles: ['SECRETARY'] },
  { label: 'Inscrire un élève', href: '/dashboard/secretary/register-student', icon: 'UserPlus', roles: ['SECRETARY'] },
  { label: 'Élèves', href: '/dashboard/secretary/students', icon: 'Student', roles: ['SECRETARY'] },
  { label: 'Paiements frais', href: '/dashboard/secretary/tuition-payments', icon: 'Check', roles: ['SECRETARY'] },
  { label: 'Certificats', href: '/dashboard/secretary/certificates', icon: 'FileText', roles: ['SECRETARY'] },
  { label: 'Documents', href: '/dashboard/secretary/documents', icon: 'FileText', roles: ['SECRETARY'] },
  { label: 'Mes congés', href: '/dashboard/employee/leaves', icon: 'Calendar', roles: ['SECRETARY'] },
  // { label: 'Factures', href: '/dashboard/secretary/invoices', icon: 'DollarSign', roles: ['SECRETARY'] },
  
  // Comptable
  { label: 'Tableau de bord', href: '/dashboard/accountant', icon: 'Home', roles: ['ACCOUNTANT'] },
  // { label: 'Factures', href: '/dashboard/accountant/invoices', icon: 'FileText', roles: ['ACCOUNTANT'] },
  // { label: 'Paiements', href: '/dashboard/accountant/payments', icon: 'DollarSign', roles: ['ACCOUNTANT'] },
  { label: 'Frais de scolarité', href: '/dashboard/accountant/tuition-fees', icon: 'DollarSign', roles: ['ACCOUNTANT'] },
  { label: 'Paiements frais', href: '/dashboard/accountant/tuition-payments', icon: 'Check', roles: ['ACCOUNTANT'] },
  { label: 'Relances', href: '/dashboard/accountant/payment-reminders', icon: 'Activity', roles: ['ACCOUNTANT'] },
  // { label: 'Factures CIE/SODECI', href: '/dashboard/accountant/supplier-invoices', icon: 'FileText', roles: ['ACCOUNTANT'] },
  { label: 'Trésorerie', href: '/dashboard/accountant/treasury', icon: 'DollarSign', roles: ['ACCOUNTANT'] },
  { label: 'Salaires', href: '/dashboard/accountant/payroll', icon: 'DollarSign', roles: ['ACCOUNTANT'] },
  { label: 'Rapports', href: '/dashboard/accountant/reports', icon: 'BarChart', roles: ['ACCOUNTANT'] },
  { label: 'Mes congés', href: '/dashboard/employee/leaves', icon: 'Calendar', roles: ['ACCOUNTANT'] },
  
  // Enseignant
  { label: 'Tableau de bord', href: '/dashboard/teacher', icon: 'Home', roles: ['TEACHER'] },
  { label: 'Mes classes', href: '/dashboard/teacher/classes', icon: 'BookOpen', roles: ['TEACHER'] },
  { label: 'Emploi du temps', href: '/dashboard/teacher/timetable', icon: 'Calendar', roles: ['TEACHER'] },
  { label: 'Présence', href: '/dashboard/teacher/attendance', icon: 'Check', roles: ['TEACHER'] },
  // { label: 'Notes', href: '/dashboard/teacher/grades', icon: 'FileText', roles: ['TEACHER'] },
  // { label: 'Messagerie', href: '/dashboard/teacher/messages', icon: 'Mail', roles: ['TEACHER'] },
  { label: 'Mes élèves', href: '/dashboard/teacher/students', icon: 'Student', roles: ['TEACHER'] },
  // { label: 'Cahier de texte', href: '/dashboard/teacher/lessons', icon: 'BookOpen', roles: ['TEACHER'] },
  { label: 'Mes congés', href: '/dashboard/employee/leaves', icon: 'Calendar', roles: ['TEACHER'] },
  
  // Parent
  { label: 'Tableau de bord', href: '/dashboard/parent', icon: 'Home', roles: ['PARENT'] },
  { label: 'Mes enfants', href: '/dashboard/parent/children', icon: 'Users', roles: ['PARENT'] },
  { label: 'Frais de scolarité', href: '/dashboard/parent/tuition-fees', icon: 'DollarSign', roles: ['PARENT'] },
  { label: 'Avancement paiements', href: '/dashboard/parent/payment-status', icon: 'Check', roles: ['PARENT'] },
  { label: 'Emploi du temps', href: '/dashboard/parent/timetable', icon: 'Calendar', roles: ['PARENT'] },
  { label: 'Présences', href: '/dashboard/parent/attendance', icon: 'Check', roles: ['PARENT'] },
  // { label: 'Notes', href: '/dashboard/parent/grades', icon: 'FileText', roles: ['PARENT'] },
  // { label: 'Messagerie', href: '/dashboard/parent/messages', icon: 'Mail', roles: ['PARENT'] },
  // { label: 'Cahier de texte', href: '/dashboard/parent/lessons', icon: 'BookOpen', roles: ['PARENT'] },
  // { label: 'Factures', href: '/dashboard/parent/invoices', icon: 'DollarSign', roles: ['PARENT'] },
];

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const { user, signOut, hasRole } = useAuth();
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const filteredNav = navigationItems.filter((item) =>
    item.roles.some((role) => hasRole(role))
  );

  // Fetch unread notifications count
  useEffect(() => {
    if (!user?.id) return;

    async function fetchUnreadCount() {
      const { count } = await supabase
        .from('notification_recipients')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user?.id)
        .is('read_at', null);

      setUnreadCount(count || 0);
    }

    fetchUnreadCount();

    // Real-time subscription
    const channel = supabase
      .channel('notification_updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notification_recipients',
          filter: `user_id=eq.${user.id}`
        },
        () => {
          fetchUnreadCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-50 via-white to-neutral-100">
      {/* Topbar */}
      <header className="sticky top-0 z-40 backdrop-blur-md bg-white/70 border-b border-neutral-200">
        <div className="flex items-center justify-between h-14 px-4 md:px-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="lg:hidden p-2 rounded-lg hover:bg-neutral-100 transition-base"
            >
              <Icons.Menu className="h-5 w-5" />
            </button>
            <div>
              <p className="text-xs uppercase tracking-[0.08em] text-neutral-500">École</p>
              <h1 className="text-lg font-semibold text-neutral-900">Console</h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link 
              href="/dashboard/notifications"
              className="relative p-2 rounded-lg hover:bg-neutral-100 transition-base"
            >
              <Icons.Bell className="h-5 w-5 text-neutral-600" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 h-5 w-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Link>

            <div className="flex items-center gap-3 rounded-full border border-neutral-200 bg-white px-2.5 py-1.5 shadow-sm">
              <Avatar name={user?.full_name || ''} src={user?.avatar_url} />
              <div className="hidden sm:block">
                <p className="text-sm font-medium text-neutral-900 leading-tight">{user?.full_name}</p>
                <p className="text-xs text-neutral-500 leading-tight">{user?.role.replace('_', ' ')}</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="flex min-w-0">
        {/* Sidebar */}
        <aside
          className={cn(
            'fixed inset-y-0 left-0 z-30 w-64 bg-white/90 backdrop-blur border-r border-neutral-200 transform transition-transform duration-200 lg:translate-x-0 lg:static shadow-sm overflow-y-auto',
            isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
          )}
        >
          <nav className="flex flex-col h-full pt-16 lg:pt-4 pb-4">
            <div className="flex-1 px-3 space-y-1">
              {filteredNav.map((item) => {
                const Icon = Icons[item.icon];
                const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
                
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={cn(
                      'group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-base border border-transparent',
                      isActive
                        ? 'bg-neutral-900 text-white border-neutral-900 shadow-sm'
                        : 'text-neutral-700 hover:bg-neutral-100'
                    )}
                  >
                    <span className={cn(
                      'h-7 w-7 rounded-md flex items-center justify-center transition-colors',
                      isActive ? 'bg-white/15 text-white' : 'bg-neutral-100 text-neutral-700 group-hover:bg-neutral-200'
                    )}>
                      <Icon className="h-4 w-4" />
                    </span>
                    {item.label}
                  </Link>
                );
              })}
            </div>

            <div className="px-3 pt-4 border-t border-neutral-200 space-y-1">
              <Link
                href="/dashboard/profile"
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-neutral-700 hover:bg-neutral-100 transition-base"
              >
                <Icons.Users className="h-5 w-5" />
                Mon profil
              </Link>
              
              <Link
                href="/dashboard/settings"
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-neutral-700 hover:bg-neutral-100 transition-base"
              >
                <Icons.Settings className="h-5 w-5" />
                Paramètres
              </Link>
              
              <button
                onClick={signOut}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-neutral-700 hover:bg-neutral-100 transition-base"
              >
                <Icons.LogOut className="h-5 w-5" />
                Déconnexion
              </button>
            </div>
          </nav>
        </aside>

        {/* Mobile overlay */}
        {isMobileMenuOpen && (
          <div
            className="fixed inset-0 z-20 bg-black/30 lg:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
          />
        )}

        {/* Main content */}
        <main className="flex-1 min-w-0 p-4 md:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
