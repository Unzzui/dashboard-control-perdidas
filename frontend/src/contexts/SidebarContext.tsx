'use client'

import { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react'

type ViewMode = 'normal' | 'collapsed'

interface SidebarContextType {
  mode: ViewMode
  isNormal: boolean
  isCollapsed: boolean
  setNormal: () => void
  setCollapsed: () => void
  toggleCollapse: () => void
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined)

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ViewMode>('normal')

  const setNormal = useCallback(() => setMode('normal'), [])
  const setCollapsed = useCallback(() => setMode('collapsed'), [])

  const toggleCollapse = useCallback(() => {
    setMode(current => current === 'normal' ? 'collapsed' : 'normal')
  }, [])

  return (
    <SidebarContext.Provider
      value={{
        mode,
        isNormal: mode === 'normal',
        isCollapsed: mode === 'collapsed',
        setNormal,
        setCollapsed,
        toggleCollapse,
      }}
    >
      {children}
    </SidebarContext.Provider>
  )
}

export function useSidebar() {
  const context = useContext(SidebarContext)
  if (!context) {
    throw new Error('useSidebar must be used within a SidebarProvider')
  }
  return context
}
