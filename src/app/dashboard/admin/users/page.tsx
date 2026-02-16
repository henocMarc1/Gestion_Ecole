'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { Icons } from '@/components/ui/Icons';
import { toast } from 'sonner';
import { notifyNewUser } from '@/lib/notificationHelpers';
import { UserDetailsModal } from '@/components/users/UserDetailsModal';

interface User {
  id: string;
  email: string;
  full_name: string;
  role: string;
  phone: string | null;
  is_active: boolean;
  last_login_at: string | null;
}

interface NewUser {
  email: string;
  full_name: string;
  phone: string;
  role: string;
  salary: string;
  password: string;
  confirmPassword: string;
}

const ROLE_LABELS: Record<string, string> = {
  SECRETARY: 'Secrétaire',
  ACCOUNTANT: 'Comptable',
  TEACHER: 'Enseignant',
  PARENT: 'Parent',
  HR: 'Ressources Humaines',
};

const ROLE_COLORS: Record<string, string> = {
  SECRETARY: 'bg-blue-100 text-blue-700',
  ACCOUNTANT: 'bg-green-100 text-green-700',
  TEACHER: 'bg-yellow-100 text-yellow-700',
  PARENT: 'bg-neutral-100 text-neutral-700',
  HR: 'bg-orange-100 text-orange-700',
};

export default function UsersPage() {
  const { user } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState<'name-asc' | 'name-desc' | 'date-created'>('date-created');
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [selectedUser, setSelectedUser] = useState<{ id: string; role: string } | null>(null);
  const [newUserData, setNewUserData] = useState<NewUser>({
    email: '',
    full_name: '',
    phone: '',
    role: 'TEACHER',
    salary: '',
    password: '',
    confirmPassword: '',
  });

  useEffect(() => {
    loadUsers();
  }, [user]);

  useEffect(() => {
    filterUsers();
  }, [searchTerm, users, roleFilter, statusFilter, sortBy]);

  const loadUsers = async () => {
    if (!user?.school_id) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id,email,full_name,phone,role,school_id,is_active,last_login_at,created_at,updated_at,deleted_at')
        .eq('school_id', user.school_id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      toast.error('Erreur lors du chargement');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const filterUsers = () => {
    const term = searchTerm.toLowerCase();
    let filtered = users.filter(u => {
      const matchesSearch = u.email.toLowerCase().includes(term) ||
        u.full_name.toLowerCase().includes(term);
      const matchesRole = roleFilter === 'ALL' || u.role === roleFilter;
      const matchesStatus = statusFilter === 'ALL' ||
        (statusFilter === 'ACTIVE' && u.is_active) ||
        (statusFilter === 'INACTIVE' && !u.is_active);
      return matchesSearch && matchesRole && matchesStatus;
    });

    // Apply sorting
    filtered.sort((a, b) => {
      switch(sortBy) {
        case 'name-asc':
          return a.full_name.localeCompare(b.full_name, 'fr-FR');
        case 'name-desc':
          return b.full_name.localeCompare(a.full_name, 'fr-FR');
        case 'date-created':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        default:
          return 0;
      }
    });

    setFilteredUsers(filtered);
  };

  const toggleUserStatus = async (userId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('users')
        .update({ is_active: !currentStatus })
        .eq('id', userId);

      if (error) throw error;
      toast.success(`Utilisateur ${!currentStatus ? 'activé' : 'désactivé'}`);
      loadUsers();
    } catch (error) {
      toast.error('Erreur lors de la modification');
      console.error(error);
    }
  };

  const formatDate = (date: string | null) => {
    if (!date) return 'Jamais';
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(date));
  };

  const formatCurrency = (amount?: number | null) => {
    if (!amount) return '-';
    return `${amount.toLocaleString('fr-CI')} XOF`;
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newUserData.email || !newUserData.full_name || !newUserData.password) {
      toast.error('Email, nom et mot de passe sont requis');
      return;
    }

    const isEmployeeRole = newUserData.role !== 'PARENT';
    const salaryValue = newUserData.salary ? Number(newUserData.salary) : 0;

    // Validation du salaire seulement s'il est saisi
    if (newUserData.salary) {
      if (Number.isNaN(salaryValue) || salaryValue < 0) {
        toast.error('Veuillez saisir un salaire valide');
        return;
      }
      if (salaryValue > 9999999999) {
        toast.error('Le salaire ne peut pas dépasser 9 999 999 999');
        return;
      }
    }

    if (newUserData.password.length < 6) {
      toast.error('Le mot de passe doit contenir au moins 6 caractères');
      return;
    }

    if (newUserData.password !== newUserData.confirmPassword) {
      toast.error('Les mots de passe ne correspondent pas');
      return;
    }

    setIsCreating(true);
    try {
      // Sauvegarder la session actuelle
      const { data: { session: currentSession } } = await supabase.auth.getSession();

      // Créer le compte Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: newUserData.email,
        password: newUserData.password,
        options: {
          data: {
            full_name: newUserData.full_name,
            role: newUserData.role,
          }
        }
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error('Création du compte échouée');

      // Créer l'utilisateur dans la table users
      const { error: userError } = await supabase
        .from('users')
        .insert([{
          id: authData.user.id,
          email: newUserData.email,
          full_name: newUserData.full_name,
          phone: newUserData.phone || null,
          role: newUserData.role,
          school_id: user?.school_id,
          salary: isEmployeeRole ? salaryValue : 0,
          is_active: true,
        }]);

      if (userError) throw userError;

      // Créer une fiche de paie pour les employés avec salaire
      if (isEmployeeRole) {
        try {
          const { error: payrollError } = await supabase
            .from('payrolls')
            .insert([{
              school_id: user?.school_id,
              employee_id: authData.user.id,
              employee_name: newUserData.full_name,
              period: new Date().toISOString().slice(0, 7), // YYYY-MM format
              base_salary: salaryValue,
              bonuses: 0,
              deductions: 0,
              net_salary: salaryValue,
              status: 'DRAFT',
            }]);

          if (payrollError) {
            console.warn('Avertissement - Fiche de paie non créée:', payrollError);
            // Ne pas bloquer la création de l'utilisateur
          } else {
            console.log('Fiche de paie créée avec succès:', salaryValue);
          }
        } catch (payrollErr) {
          console.warn('Avertissement - Fiche de paie non créée:', payrollErr);
          // Ne pas bloquer la création de l'utilisateur
        }
      }

      // Créer une notification pour les admins
      try {
        await notifyNewUser(user?.school_id || '', newUserData.full_name, newUserData.role, authData.user.id);
      } catch (notifError) {
        console.warn('Avertissement - Notification non créée:', notifError);
        // Ne pas bloquer la création de l'utilisateur
      }

      // Restaurer la session du directeur
      if (currentSession) {
        await supabase.auth.setSession({
          access_token: currentSession.access_token,
          refresh_token: currentSession.refresh_token,
        });
      }

      toast.success('Utilisateur créé avec succès!');
      setNewUserData({
        email: '',
        full_name: '',
        phone: '',
        role: 'TEACHER',
        salary: '',
        password: '',
        confirmPassword: '',
      });
      setIsModalOpen(false);
      
      // Recharger la liste des utilisateurs sans recharger la page
      await loadUsers();
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la création');
      console.error('ERREUR CRÉATION:', error);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-semibold text-neutral-900">Gestion des utilisateurs</h1>
          <p className="text-sm text-neutral-600 mt-1">
            Gérez les utilisateurs de votre école ({filteredUsers.length} au total)
          </p>
        </div>
        <Button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2">
          <Icons.Plus className="w-4 h-4" />
          Nouvel utilisateur
        </Button>
      </div>

      {/* Filtres et Recherche */}
      <Card className="border border-neutral-200 shadow-sm p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="relative">
            <Icons.Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
            <input
              type="text"
              placeholder="Chercher par email ou nom..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            />
          </div>
          
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500"
          >
            <option value="ALL">Tous les rôles</option>
            <option value="ADMIN">Directeur</option>
            <option value="TEACHER">Enseignant</option>
            <option value="SECRETARY">Secrétaire</option>
            <option value="ACCOUNTANT">Comptable</option>
            <option value="HR">RH</option>
            <option value="PARENT">Parent</option>
          </select>
          
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500"
          >
            <option value="ALL">Tous les statuts</option>
            <option value="ACTIVE">Actifs</option>
            <option value="INACTIVE">Inactifs</option>
          </select>
          
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500"
          >
            <option value="name-asc">Nom (A → Z)</option>
            <option value="name-desc">Nom (Z → A)</option>
            <option value="date-created">Plus récents</option>
          </select>
        </div>
      </Card>

      {/* Tableau */}
      {isLoading ? (
        <Card className="p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-neutral-900 mx-auto" />
        </Card>
      ) : filteredUsers.length === 0 ? (
        <Card className="p-12 text-center border border-dashed border-neutral-300">
          <Icons.Users className="w-12 h-12 text-neutral-400 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-neutral-900 mb-1">Aucun utilisateur</h3>
        </Card>
      ) : (
        <Card className="border border-neutral-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-neutral-50 border-b border-neutral-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-600">Nom</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-600">Email</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-600">Rôle</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-600">Dernière connexion</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-600">Statut</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-neutral-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {filteredUsers.map((u) => (
                  <tr 
                    key={u.id} 
                    className="hover:bg-neutral-50 cursor-pointer"
                    onClick={() => setSelectedUser({ id: u.id, role: u.role })}
                  >
                    <td className="px-6 py-4 font-medium text-neutral-900">{u.full_name}</td>
                    <td className="px-6 py-4 text-sm text-neutral-600">{u.email}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${ROLE_COLORS[u.role] || 'bg-neutral-100'}`}>
                        {ROLE_LABELS[u.role] || u.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-neutral-600">{formatDate(u.last_login_at)}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        u.is_active ? 'bg-success-100 text-success-700' : 'bg-neutral-200 text-neutral-700'
                      }`}>
                        {u.is_active ? 'Actif' : 'Inactif'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleUserStatus(u.id, u.is_active);
                        }}
                      >
                        {u.is_active ? (
                          <Icons.X className="w-4 h-4 text-danger-600" />
                        ) : (
                          <Icons.Check className="w-4 h-4 text-success-600" />
                        )}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Modal Création */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-lg border-0 shadow-xl">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold text-neutral-900">
                  Créer un utilisateur
                </h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsModalOpen(false)}
                >
                  <Icons.X className="w-5 h-5" />
                </Button>
              </div>

              <form onSubmit={handleCreateUser} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="email"
                    value={newUserData.email}
                    onChange={(e) => setNewUserData({ ...newUserData, email: e.target.value })}
                    placeholder="utilisateur@example.com"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">
                    Nom complet <span className="text-red-500">*</span>
                  </label>
                  <Input
                    value={newUserData.full_name}
                    onChange={(e) => setNewUserData({ ...newUserData, full_name: e.target.value })}
                    placeholder="Jean Dupont"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">
                    Téléphone
                  </label>
                  <Input
                    value={newUserData.phone}
                    onChange={(e) => setNewUserData({ ...newUserData, phone: e.target.value })}
                    placeholder="+225 01 02 03 04 05"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">
                    Rôle <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={newUserData.role}
                    onChange={(e) => setNewUserData({ ...newUserData, role: e.target.value })}
                    className="w-full px-3 py-2 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    required
                  >
                    <option value="TEACHER">Enseignant</option>
                    <option value="SECRETARY">Secrétaire</option>
                    <option value="ACCOUNTANT">Comptable</option>
                    <option value="HR">Ressources Humaines</option>
                    <option value="PARENT">Parent</option>
                  </select>
                </div>

                {newUserData.role !== 'PARENT' && (
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">
                      Salaire (XOF) <span className="text-red-500">*</span>
                    </label>
                    <Input
                      type="number"
                      min="0"
                      step="1000"
                      value={newUserData.salary}
                      onChange={(e) => setNewUserData({ ...newUserData, salary: e.target.value })}
                      placeholder="Ex: 350000"
                    />
                    <p className="text-xs text-neutral-500 mt-1">Requis pour les employés.</p>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">
                    Mot de passe <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="password"
                    value={newUserData.password}
                    onChange={(e) => setNewUserData({ ...newUserData, password: e.target.value })}
                    placeholder="Minimum 6 caractères"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">
                    Confirmer le mot de passe <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="password"
                    value={newUserData.confirmPassword}
                    onChange={(e) => setNewUserData({ ...newUserData, confirmPassword: e.target.value })}
                    placeholder="Retaper le mot de passe"
                    required
                  />
                </div>

                <div className="flex gap-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1"
                    disabled={isCreating}
                  >
                    Annuler
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1"
                    disabled={isCreating}
                  >
                    {isCreating ? 'Création...' : 'Créer'}
                  </Button>
                </div>
              </form>
            </div>
          </Card>
        </div>
      )}

      {/* Modal Détails Utilisateur */}
      {selectedUser && (
        <UserDetailsModal
          userId={selectedUser.id}
          userRole={selectedUser.role}
          onClose={() => {
            setSelectedUser(null);
            loadUsers();
          }}
          onEdit={() => {
            // TODO: Implémenter la modification
            toast.info('Fonctionnalité de modification à venir');
          }}
        />
      )}
    </div>
  );
}
