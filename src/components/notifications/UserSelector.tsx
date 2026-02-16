'use client'

import { useState, useMemo } from 'react'
import { Icons } from '@/components/ui/Icons'

interface User {
  id: string
  full_name: string
  email: string
  role: string
}

interface UserSelectorProps {
  users: User[]
  selectedUsers: string[]
  onSelectionChange: (selectedIds: string[]) => void
  className?: string
}

export function UserSelector({ users, selectedUsers, onSelectionChange, className = '' }: UserSelectorProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [isExpanded, setIsExpanded] = useState(false)

  // Filtrer les utilisateurs en fonction de la recherche
  const filteredUsers = useMemo(() => {
    if (!searchTerm.trim()) return users

    const search = searchTerm.toLowerCase()
    return users.filter(
      (user) =>
        user.full_name.toLowerCase().includes(search) ||
        user.email.toLowerCase().includes(search) ||
        user.role.toLowerCase().includes(search)
    )
  }, [users, searchTerm])

  const selectedUsersData = useMemo(() => {
    return users.filter((u) => selectedUsers.includes(u.id))
  }, [users, selectedUsers])

  const toggleUser = (userId: string) => {
    if (selectedUsers.includes(userId)) {
      onSelectionChange(selectedUsers.filter((id) => id !== userId))
    } else {
      onSelectionChange([...selectedUsers, userId])
    }
  }

  const selectAll = () => {
    onSelectionChange(filteredUsers.map((u) => u.id))
  }

  const deselectAll = () => {
    onSelectionChange([])
  }

  const removeUser = (userId: string) => {
    onSelectionChange(selectedUsers.filter((id) => id !== userId))
  }

  return (
    <div className={className}>
      {/* Selected Users Tags */}
      {selectedUsers.length > 0 && (
        <div className="mb-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">
              {selectedUsers.length} utilisateur(s) sélectionné(s)
            </span>
            <button
              type="button"
              onClick={deselectAll}
              className="text-xs text-red-600 hover:text-red-700 font-medium"
            >
              Tout désélectionner
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {selectedUsersData.map((user) => (
              <span
                key={user.id}
                className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm"
              >
                <span className="font-medium">{user.full_name}</span>
                <span className="text-blue-500">•</span>
                <span className="text-xs">{user.role}</span>
                <button
                  type="button"
                  onClick={() => removeUser(user.id)}
                  className="ml-1 hover:bg-blue-200 rounded-full p-0.5"
                >
                  <Icons.X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Search Bar */}
      <div className="relative mb-2">
        <div className="relative">
          <Icons.Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher par nom, email ou rôle..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onFocus={() => setIsExpanded(true)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <Icons.X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Users List */}
      {isExpanded && (
        <div className="border border-gray-300 rounded-lg bg-white shadow-lg">
          {/* Actions Header */}
          <div className="flex items-center justify-between p-3 border-b border-gray-200 bg-gray-50">
            <span className="text-sm text-gray-600">
              {filteredUsers.length} résultat(s)
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={selectAll}
                className="text-xs text-blue-600 hover:text-blue-700 font-medium"
              >
                Tout sélectionner
              </button>
              <span className="text-gray-300">|</span>
              <button
                type="button"
                onClick={() => setIsExpanded(false)}
                className="text-xs text-gray-600 hover:text-gray-700 font-medium"
              >
                Fermer
              </button>
            </div>
          </div>

          {/* Scrollable List */}
          <div className="max-h-64 overflow-y-auto">
            {filteredUsers.length === 0 ? (
              <div className="p-4 text-center text-gray-500 text-sm">
                <Icons.AlertCircle className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                Aucun utilisateur trouvé
              </div>
            ) : (
              filteredUsers.map((user) => {
                const isSelected = selectedUsers.includes(user.id)
                return (
                  <label
                    key={user.id}
                    className={`flex items-center gap-3 p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0 ${
                      isSelected ? 'bg-blue-50' : ''
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleUser(user.id)}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900 truncate">
                          {user.full_name}
                        </span>
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                            user.role === 'PARENT'
                              ? 'bg-purple-100 text-purple-700'
                              : user.role === 'TEACHER'
                              ? 'bg-green-100 text-green-700'
                              : user.role === 'ADMIN'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {user.role}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 truncate">{user.email}</div>
                    </div>
                    {isSelected && (
                      <Icons.CheckCircle className="h-5 w-5 text-blue-600 flex-shrink-0" />
                    )}
                  </label>
                )
              })
            )}
          </div>
        </div>
      )}

      {/* Collapsed View */}
      {!isExpanded && (
        <button
          type="button"
          onClick={() => setIsExpanded(true)}
          className="w-full p-3 border border-gray-300 rounded-lg text-left text-sm text-gray-600 hover:bg-gray-50 flex items-center justify-between"
        >
          <span>Cliquez pour afficher la liste ({users.length} utilisateurs)</span>
          <Icons.ChevronDown className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}
