import { useEffect, useState } from "react"
import { supabase } from "../lib/supabase"
import { getUserProfile } from "../services/authService"

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const getUserProfileWithRetry = async (userId, retries = 2, delayMs = 300) => {
  let last = null
  for (let i = 0; i <= retries; i += 1) {
    const profile = await getUserProfile(userId)
    if (profile) return profile
    last = profile
    if (i < retries) await wait(delayMs)
  }
  return last
}

export function useCurrentUser() {
  const [user, setUser] = useState(null)
  const [userProfile, setUserProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    const syncAuthState = async () => {
      if (!mounted) return
      setLoading(true)
      const { data: { session } } = await supabase.auth.getSession()
      const authUser = session?.user ?? null
      if (!mounted) return

      setUser(authUser)
      if (authUser) {
        const profile = await getUserProfileWithRetry(authUser.id)
        if (!mounted) return
        setUserProfile(profile || null)
      } else {
        setUserProfile(null)
      }

      if (!mounted) return
      setLoading(false)
    }

    syncAuthState()

    // Escuchar cambios de auth
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      if (!mounted) return
      setLoading(true)
      const authUser = nextSession?.user ?? null
      setUser(authUser)

      if (authUser) {
        const profile = await getUserProfileWithRetry(authUser.id)
        if (!mounted) return
        setUserProfile(profile || null)
      } else {
        setUserProfile(null)
      }

      if (!mounted) return
      setLoading(false)
    })

    return () => {
      mounted = false
      subscription?.unsubscribe()
    }
  }, [])

  return { user, userProfile, loading }
}
