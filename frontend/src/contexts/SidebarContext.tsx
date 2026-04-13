'use client'

import { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react'

type ViewMode = 'normal' | 'collapsed' | 'presentation'

interface SidebarContextType {
  mode: ViewMode
  isNormal: boolean
  isCollapsed: boolean
  isPresentation: boolean
  setNormal: () => void
  setCollapsed: () => void
  setPresentation: () => void
  toggleCollapse: () => void
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined)

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ViewMode>('normal')
  const [previousMode, setPreviousMode] = useState<ViewMode>('normal')

  const setNormal = useCallback(() => setMode('normal'), [])
  const setCollapsed = useCallback(() => setMode('collapsed'), [])
  const setPresentation = useCallback(() => {
    setPreviousMode(mode === 'presentation' ? 'normal' : mode)
    setMode('presentation')
  }, [mode])

  const toggleCollapse = useCallback(() => {
    setMode(current => current === 'normal' ? 'collapsed' : 'normal')
  }, [])

  // Manejar tecla Escape para salir de presentación
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && mode === 'presentation') {
        setMode(previousMode)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [mode, previousMode])

  return (
    <SidebarContext.Provider
      value={{
        mode,
        isNormal: mode === 'normal',
        isCollapsed: mode === 'collapsed',
        isPresentation: mode === 'presentation',
        setNormal,
        setCollapsed,
        setPresentation,
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
