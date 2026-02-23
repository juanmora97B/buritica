import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { supabase } from "../lib/supabase"
import { syncUserProfile } from "../services/authService"

const mapErrorMessage = (message = "") => {
  const normalized = message.toLowerCase()

  if (normalized.includes("failed to fetch")) {
    return "No se pudo conectar con Supabase. Revisa internet y que la URL del proyecto esté permitida en Redirect URLs."
  }

  if (normalized.includes("invalid flow state")) {
    return "El enlace de confirmación es inválido o expiró. Solicita uno nuevo."
  }

  return message || "No se pudo completar la autenticación"
}

export default function AuthCallback() {
  const navigate = useNavigate()
  const [status, setStatus] = useState("Procesando confirmación...")
  const [error, setError] = useState("")

  useEffect(() => {
    let mounted = true

    const finishAuth = async () => {
      try {
        const url = new URL(window.location.href)
        const queryError = url.searchParams.get("error_description") || url.searchParams.get("error")
        if (queryError) {
          throw new Error(decodeURIComponent(queryError))
        }

        const {
          data: { session: currentSession },
          error: sessionError
        } = await supabase.auth.getSession()

        if (sessionError) throw sessionError

        if (currentSession?.user) {
          await syncUserProfile(currentSession.user)
          if (mounted) navigate("/", { replace: true })
          return
        }

        const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(window.location.href)
        if (exchangeError) throw exchangeError

        if (!data?.session?.user) {
          throw new Error("No se pudo crear la sesión de usuario")
        }

        await syncUserProfile(data.session.user)
        if (mounted) navigate("/", { replace: true })
      } catch (err) {
        if (!mounted) return
        setStatus("")
        setError(mapErrorMessage(err?.message))
      }
    }

    finishAuth()

    return () => {
      mounted = false
    }
  }, [navigate])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <div className="bg-white p-6 rounded-xl shadow w-full max-w-md">
        <h1 className="text-xl font-bold mb-3">Confirmando cuenta</h1>
        {status && <p className="text-gray-700">{status}</p>}
        {error && <p className="text-red-600 text-sm">{error}</p>}
      </div>
    </div>
  )
}