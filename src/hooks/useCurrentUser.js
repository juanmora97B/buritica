import { useEffect, useState } from "react"
import { supabase } from "../lib/supabase"
import { getUserProfile } from "../services/authService"

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const withTimeout = (promise, timeoutMs = 8000) =>
  Promise.race([
    promise,
    new Promise((resolve) => setTimeout(() => resolve(null), timeoutMs))
  ])

const getUserProfileWithRetry = async (userId, retries = 2, delayMs = 300) => {
  let last = null
  for (let i = 0; i <= retries; i += 1) {
    const profile = await withTimeout(getUserProfile(userId))
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

    const syncAuthState = async (nextSession = null) => {
      if (!mounted) return
      setLoading(true)
      try {
        const session = nextSession ?? (await supabase.auth.getSession()).data.session
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
      } catch (error) {
        console.error("Error syncing auth state:", error)
        if (!mounted) return
        setUserProfile(null)
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    syncAuthState()

    // Escuchar cambios de auth
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!mounted) return

      if (event === "TOKEN_REFRESHED" || event === "INITIAL_SESSION") {
        return
      }

      syncAuthState(nextSession)
    })

    return () => {
      mounted = false
      subscription?.unsubscribe()
    }
  }, [])

  return { user, userProfile, loading }
}
