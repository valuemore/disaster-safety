'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Role } from '@/lib/types/db'

const STORAGE_KEY = 'dsmvp_role'

interface RoleContextValue {
  role: Role | null
  setRole: (role: Role) => void
  clearRole: () => void
}

const RoleContext = createContext<RoleContextValue | null>(null)

export function RoleProvider({ children }: { children: ReactNode }) {
  const [role, setRoleState] = useState<Role | null>(null)

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as Role | null
    if (stored) setRoleState(stored)
  }, [])

  function setRole(next: Role) {
    localStorage.setItem(STORAGE_KEY, next)
    setRoleState(next)
  }

  function clearRole() {
    localStorage.removeItem(STORAGE_KEY)
    setRoleState(null)
  }

  return (
    <RoleContext.Provider value={{ role, setRole, clearRole }}>
      {children}
    </RoleContext.Provider>
  )
}

export function useRole(): RoleContextValue {
  const ctx = useContext(RoleContext)
  if (!ctx) throw new Error('useRole must be used within RoleProvider')
  return ctx
}
