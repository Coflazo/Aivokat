import React from 'react'

export type UserRole = 'peter' | 'suzanne'

export interface AppUser {
  name: string
  role: UserRole
}

interface UserCtx {
  user: AppUser | null
  setUser: (u: AppUser | null) => void
}

export const UserContext = React.createContext<UserCtx>({ user: null, setUser: () => {} })

export function useUser(): UserCtx {
  return React.useContext(UserContext)
}

export function UserProvider({ children }: { children: React.ReactNode }): JSX.Element {
  const [user, setUserState] = React.useState<AppUser | null>(() => {
    try {
      const stored = localStorage.getItem('lou_user')
      return stored ? (JSON.parse(stored) as AppUser) : null
    } catch {
      return null
    }
  })

  function setUser(u: AppUser | null): void {
    setUserState(u)
    if (u) {
      localStorage.setItem('lou_user', JSON.stringify(u))
    } else {
      localStorage.removeItem('lou_user')
    }
  }

  return (
    <UserContext.Provider value={{ user, setUser }}>
      {children}
    </UserContext.Provider>
  )
}
