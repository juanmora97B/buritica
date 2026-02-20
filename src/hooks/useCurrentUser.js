import { useEffect, useState } from "react"
import { supabase } from "../lib/supabase"
import { getUserProfile } from "../services/authService"

export function useCurrentUser() {
  const [user, setUser] = useState(null)
  const [userProfile, setUserProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const getUser = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      const authUser = session?.user ?? null
      
      setUser(authUser)

      if (authUser) {
        const profile = await getUserProfile(authUser.id)
        setUserProfile(profile)
      }

      setLoading(false)
    }

    getUser()

    // Escuchar cambios de auth
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      const authUser = nextSession?.user ?? null
      setUser(authUser)

      if (authUser) {
        const profile = await getUserProfile(authUser.id)
        setUserProfile(profile)
      } else {
        setUserProfile(null)
      }
    })

    return () => {
      subscription?.unsubscribe()
    }
  }, [])

  return { user, userProfile, loading }
}
