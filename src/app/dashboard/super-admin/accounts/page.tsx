'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Icons } from '@/components/ui/Icons';
import { useRealtimeSubscription, RealtimePayload } from '@/hooks/useRealtimeSubscription';

interface User {
  id: string;
  email: string;
  full_name: string;
  role: string;
  phone: string | null;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
  school_id: string | null;
  school?: {
    name: string;
    code: string;
  };
}

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN: 'Directeur',
  SECRETARY: 'Secrétaire',
  ACCOUNTANT: 'Comptable',
  TEACHER: 'Enseignant',
  PARENT: 'Parent',
  HR: 'Ressources Humaines',
};

const ROLE_COLORS: Record<string, string> = {
  SUPER_ADMIN: 'bg-purple-100 text-purple-700',
  ADMIN: 'bg-primary-100 text-primary-700',
  SECRETARY: 'bg-blue-100 text-blue-700',
  ACCOUNTANT: 'bg-green-100 text-green-700',
  TEACHER: 'bg-yellow-100 text-yellow-700',
  PARENT: 'bg-neutral-100 text-neutral-700',
  HR: 'bg-orange-100 text-orange-700',
};

export default function AccountsPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRole, setSelectedRole] = useState<string>('ALL');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [schools, setSchools] = useState<Array<{ id: string; name: string; code: string }>>([]);
  const [newUserData, setNewUserData] = useState({
    email: '',
    full_name: '',
    phone: '',
    role: 'TEACHER' as const,
    school_id: '' as string | null,
    password: '',
    confirmPassword: '',
  });

  useEffect(() => {
    loadUsers();
    loadSchools();
  }, []);

  useEffect(() => {
    filterUsers();
  }, [searchTerm, selectedRole, users]);

  // Abonnement aux changements des utilisateurs
  useRealtimeSubscription({
    table: 'users',
    event: '*',
    onData: (payload) => {
      handleRealtimeUpdate(payload);
    },
    enabled: true,
  });

  const handleRealtimeUpdate = (payload: RealtimePayload) => {
    const newUser = payload.new as User;
    const oldUser = payload.old as User;

    switch (payload.eventType) {
      case 'INSERT':
        setUsers(prev => [newUser, ...prev]);
        toast.success('Nouvel utilisateur créé');
        break;
      case 'UPDATE':
        setUsers(prev =>
          prev.map(u => u.id === newUser.id ? { ...u, ...newUser } : u)
        );
        toast.success('Utilisateur mis à jour');
        break;
      case 'DELETE':
        setUsers(prev => prev.filter(u => u.id !== oldUser.id));
        toast.success('Utilisateur supprimé');
        break;
    }
  };

  const loadUsers = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('users')
        .select(`
          *,
          school:schools(name, code)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      toast.error('Erreur lors du chargement des utilisateurs');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadSchools = async () => {
    try {
      const { data, error } = await supabase
        .from('schools')
        .select('id, name, code')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setSchools(data || []);
    } catch (error) {
      console.error('Erreur lors du chargement des écoles:', error);
    }
  };

  const filterUsers = () => {
    let filtered = users;

    // Filtre par rôle
    if (selectedRole !== 'ALL') {
      filtered = filtered.filter(u => u.role === selectedRole);
    }

    // Filtre par recherche
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(u => 
        u.email.toLowerCase().includes(term) ||
        u.full_name.toLowerCase().includes(term) ||
        u.id.toLowerCase().includes(term) ||
        (u.phone && u.phone.includes(term))
      );
    }

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

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copié`);
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newUserData.email || !newUserData.full_name || !newUserData.password) {
      toast.error('Email, nom et mot de passe sont requis');
      return;
    }

    if (newUserData.password.length < 6) {
      toast.error('Le mot de passe doit contenir au moins 6 caractères');
      return;
    }

    if (newUserData.password !== newUserData.confirmPassword) {
      toast.error('Les mots de passe ne correspondent pas');
      return;
    }

    // Vérifier que l'école est sélectionnée pour les rôles qui en nécessitent une
    if (['ADMIN', 'TEACHER', 'HR', 'ACCOUNTANT', 'SECRETARY'].includes(newUserData.role) && !newUserData.school_id) {
      toast.error('Veuillez sélectionner une école pour ce rôle');
      return;
    }

    setIsCreating(true);
    try {
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
          school_id: newUserData.school_id || null,
          is_active: true,
        }]);

      if (userError) throw userError;

      toast.success('Utilisateur créé avec succès!');
      setNewUserData({
        email: '',
        full_name: '',
        phone: '',
        role: 'TEACHER',
        school_id: null,
        password: '',
        confirmPassword: '',
      });
      setIsModalOpen(false);
      loadUsers();
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la création');
      console.error(error);
    } finally {
      setIsCreating(false);
    }
  };

  const stats = {
    total: users.length,
    active: users.filter(u => u.is_active).length,
    byRole: Object.keys(ROLE_LABELS).reduce((acc, role) => {
      acc[role] = users.filter(u => u.role === role).length;
      return acc;
    }, {} as Record<string, number>),
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-semibold text-neutral-900">Gestion des utilisateurs</h1>
          <p className="text-sm text-neutral-600 mt-1">
            Vue d'ensemble de tous les comptes du système
          </p>
        </div>
        <Button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2">
          <Icons.Plus className="w-4 h-4" />
          Ajouter un utilisateur
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        <Card className="border border-neutral-200 shadow-sm">
          <div className="p-4">
            <p className="text-xs text-neutral-600 mb-1">Total</p>
            <p className="text-2xl font-bold text-neutral-900">{stats.total}</p>
          </div>
        </Card>
        <Card className="border border-neutral-200 shadow-sm">
          <div className="p-4">
            <p className="text-xs text-neutral-600 mb-1">Actifs</p>
            <p className="text-2xl font-bold text-success-600">{stats.active}</p>
          </div>
        </Card>
        {Object.entries(ROLE_LABELS).map(([role, label]) => (
          <Card key={role} className="border border-neutral-200 shadow-sm">
            <div className="p-4">
              <p className="text-xs text-neutral-600 mb-1">{label}</p>
              <p className="text-2xl font-bold text-neutral-900">{stats.byRole[role] || 0}</p>
            </div>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Card className="border border-neutral-200 shadow-sm">
        <div className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Icons.Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                <input
                  type="text"
                  placeholder="Rechercher par email, nom, UID, téléphone..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
            </div>
            <div>
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                className="px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="ALL">Tous les rôles</option>
                {Object.entries(ROLE_LABELS).map(([role, label]) => (
                  <option key={role} value={role}>{label}</option>
                ))}
              </select>
            </div>
            <Button variant="outline" onClick={loadUsers}>
              <Icons.Download className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </Card>

      {/* Users Table */}
      {isLoading ? (
        <Card className="p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-neutral-900 mx-auto" />
          <p className="text-sm text-neutral-600 mt-3">Chargement...</p>
        </Card>
      ) : filteredUsers.length === 0 ? (
        <Card className="p-12 text-center border border-dashed border-neutral-300">
          <Icons.Users className="w-12 h-12 text-neutral-400 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-neutral-900 mb-1">Aucun utilisateur</h3>
          <p className="text-sm text-neutral-600">
            {searchTerm || selectedRole !== 'ALL' 
              ? 'Aucun résultat pour ces filtres'
              : 'Commencez par créer des utilisateurs'}
          </p>
        </Card>
      ) : (
        <Card className="border border-neutral-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-neutral-50 border-b border-neutral-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-neutral-600 uppercase tracking-wider">
                    Utilisateur
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-neutral-600 uppercase tracking-wider">
                    Rôle
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-neutral-600 uppercase tracking-wider">
                    École
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-neutral-600 uppercase tracking-wider">
                    Dernière connexion
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-neutral-600 uppercase tracking-wider">
                    Statut
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-neutral-600 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-neutral-200">
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-neutral-50 transition-colors">
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
                          <span className="text-sm font-semibold text-primary-700">
                            {user.full_name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-neutral-900 truncate">{user.full_name}</p>
                          <p className="text-xs text-neutral-600 truncate">{user.email}</p>
                          {user.phone && (
                            <p className="text-xs text-neutral-500 truncate">{user.phone}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${ROLE_COLORS[user.role]}`}>
                        {ROLE_LABELS[user.role]}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      {user.school ? (
                        <div>
                          <p className="text-sm text-neutral-900">{user.school.name}</p>
                          <p className="text-xs text-neutral-500">{user.school.code}</p>
                        </div>
                      ) : (
                        <span className="text-xs text-neutral-400 italic">Global</span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <p className="text-sm text-neutral-900">{formatDate(user.last_login_at)}</p>
                      <p className="text-xs text-neutral-500">
                        Créé {formatDate(user.created_at)}
                      </p>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        user.is_active 
                          ? 'bg-success-100 text-success-700' 
                          : 'bg-neutral-200 text-neutral-700'
                      }`}>
                        {user.is_active ? 'Actif' : 'Inactif'}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedUser(user)}
                          title="Voir les détails"
                        >
                          <Icons.Info className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleUserStatus(user.id, user.is_active)}
                          title={user.is_active ? 'Désactiver' : 'Activer'}
                        >
                          {user.is_active ? (
                            <Icons.X className="w-4 h-4 text-danger-600" />
                          ) : (
                            <Icons.Check className="w-4 h-4 text-success-600" />
                          )}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* User Details Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold text-neutral-900">Ajouter un utilisateur</h2>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="text-neutral-400 hover:text-neutral-600"
                >
                  <Icons.X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateUser} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">
                    Email *
                  </label>
                  <Input
                    type="email"
                    placeholder="user@example.com"
                    value={newUserData.email}
                    onChange={(e) => setNewUserData({ ...newUserData, email: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">
                    Nom complet *
                  </label>
                  <Input
                    placeholder="Jean Dupont"
                    value={newUserData.full_name}
                    onChange={(e) => setNewUserData({ ...newUserData, full_name: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">
                    Téléphone
                  </label>
                  <Input
                    type="tel"
                    placeholder="+225 XX XX XX XX"
                    value={newUserData.phone}
                    onChange={(e) => setNewUserData({ ...newUserData, phone: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">
                    Rôle *
                  </label>
                  <select
                    value={newUserData.role}
                    onChange={(e) => setNewUserData({ ...newUserData, role: e.target.value as any })}
                    className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    required
                  >
                    {Object.entries(ROLE_LABELS).map(([role, label]) => (
                      <option key={role} value={role}>{label}</option>
                    ))}
                  </select>
                </div>

                {['ADMIN', 'TEACHER', 'HR', 'ACCOUNTANT', 'SECRETARY'].includes(newUserData.role) && (
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">
                      École * {newUserData.role !== 'SUPER_ADMIN' && '(Requis pour ce rôle)'}
                    </label>
                    <select
                      value={newUserData.school_id || ''}
                      onChange={(e) => setNewUserData({ ...newUserData, school_id: e.target.value || null })}
                      className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                      required={['ADMIN', 'TEACHER', 'HR', 'ACCOUNTANT', 'SECRETARY'].includes(newUserData.role)}
                    >
                      <option value="">-- Sélectionner une école --</option>
                      {schools.map((school) => (
                        <option key={school.id} value={school.id}>
                          {school.name} ({school.code})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">
                    Mot de passe *
                  </label>
                  <Input
                    type="password"
                    placeholder="Minimum 6 caractères"
                    value={newUserData.password}
                    onChange={(e) => setNewUserData({ ...newUserData, password: e.target.value })}
                    required
                    minLength={6}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">
                    Confirmer le mot de passe *
                  </label>
                  <Input
                    type="password"
                    placeholder="Retapez le mot de passe"
                    value={newUserData.confirmPassword}
                    onChange={(e) => setNewUserData({ ...newUserData, confirmPassword: e.target.value })}
                    required
                    minLength={6}
                  />
                </div>

                <div className="flex gap-3">
                  <Button type="submit" disabled={isCreating} className="flex-1">
                    {isCreating ? 'Création...' : 'Créer l\'utilisateur'}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
                    Annuler
                  </Button>
                </div>
              </form>
            </div>
          </Card>
        </div>
      )}

      {/* User Details Modal */}
      {selectedUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={() => setSelectedUser(null)}>
          <div onClick={(e: React.MouseEvent) => e.stopPropagation()}>
            <Card className="max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-start mb-6">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-primary-100 flex items-center justify-center">
                    <span className="text-2xl font-bold text-primary-700">
                      {selectedUser.full_name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <h2 className="text-2xl font-semibold text-neutral-900">{selectedUser.full_name}</h2>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${ROLE_COLORS[selectedUser.role]} mt-1`}>
                      {ROLE_LABELS[selectedUser.role]}
                    </span>
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setSelectedUser(null)}>
                  <Icons.X className="w-5 h-5" />
                </Button>
              </div>

              <div className="space-y-4">
                {/* UID */}
                <div className="p-4 bg-neutral-50 rounded-lg">
                  <p className="text-xs text-neutral-600 mb-1">UID (Identifiant unique)</p>
                  <div className="flex items-center justify-between gap-2">
                    <code className="text-sm font-mono text-neutral-900 break-all">{selectedUser.id}</code>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(selectedUser.id, 'UID')}
                    >
                      <Icons.FileText className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {/* Email */}
                <div className="p-4 bg-neutral-50 rounded-lg">
                  <p className="text-xs text-neutral-600 mb-1">Email</p>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm text-neutral-900">{selectedUser.email}</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(selectedUser.email, 'Email')}
                    >
                      <Icons.Mail className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {/* Phone */}
                {selectedUser.phone && (
                  <div className="p-4 bg-neutral-50 rounded-lg">
                    <p className="text-xs text-neutral-600 mb-1">Téléphone</p>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm text-neutral-900">{selectedUser.phone}</p>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(selectedUser.phone!, 'Téléphone')}
                      >
                        <Icons.Phone className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}

                {/* School */}
                {selectedUser.school && (
                  <div className="p-4 bg-neutral-50 rounded-lg">
                    <p className="text-xs text-neutral-600 mb-1">École</p>
                    <p className="text-sm text-neutral-900">{selectedUser.school.name}</p>
                    <p className="text-xs text-neutral-500 mt-0.5">{selectedUser.school.code}</p>
                  </div>
                )}

                {/* Timestamps */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 bg-neutral-50 rounded-lg">
                    <p className="text-xs text-neutral-600 mb-1">Créé le</p>
                    <p className="text-sm text-neutral-900">{formatDate(selectedUser.created_at)}</p>
                  </div>
                  <div className="p-4 bg-neutral-50 rounded-lg">
                    <p className="text-xs text-neutral-600 mb-1">Dernière connexion</p>
                    <p className="text-sm text-neutral-900">{formatDate(selectedUser.last_login_at)}</p>
                  </div>
                </div>

                {/* Status */}
                <div className="p-4 bg-neutral-50 rounded-lg">
                  <p className="text-xs text-neutral-600 mb-2">Statut du compte</p>
                  <div className="flex items-center justify-between">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                      selectedUser.is_active 
                        ? 'bg-success-100 text-success-700' 
                        : 'bg-neutral-200 text-neutral-700'
                    }`}>
                      {selectedUser.is_active ? 'Actif' : 'Inactif'}
                    </span>
                    <Button
                      variant={selectedUser.is_active ? 'outline' : 'primary'}
                      size="sm"
                      onClick={() => {
                        toggleUserStatus(selectedUser.id, selectedUser.is_active);
                        setSelectedUser(null);
                      }}
                    >
                      {selectedUser.is_active ? 'Désactiver' : 'Activer'}
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
