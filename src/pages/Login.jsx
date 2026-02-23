import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { supabase } from "../lib/supabase"
import { syncUserProfile, getCurrentUser } from "../services/authService"

export default function Login() {
  const navigate = useNavigate()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    const checkSession = async () => {
      const { data } = await supabase.auth.getSession()
      if (data.session) {
        navigate("/", { replace: true })
      }
    }

    checkSession()
  }, [navigate])

  const handleLogin = async (e) => {
    e.preventDefault()
    setError("")

    if (!email || !password) {
      setError("Ingrese correo y contraseña")
      return
    }

    setLoading(true)
    const { error: loginError } = await supabase.auth.signInWithPassword({
      email,
      password
    })

    if (loginError) {
      const rawMessage = loginError.message || ""
      const normalized = rawMessage.toLowerCase()

      if (normalized.includes("email not confirmed")) {
        setError("Este usuario debe confirmar su correo antes de iniciar sesión")
      } else if (normalized.includes("invalid login credentials")) {
        setError("Credenciales inválidas. Verifica correo y contraseña")
      } else {
        setError(rawMessage)
      }

      setLoading(false)
      return
    }

    // Obtener usuario actual y sincronizar con tabla usuarios
    const user = await getCurrentUser()
    if (user) {
      await syncUserProfile(user)
    }

    setLoading(false)
    navigate("/", { replace: true })
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <form onSubmit={handleLogin} className="bg-white p-8 rounded-xl shadow w-80">
        <h1 className="text-2xl font-bold mb-6 text-center">
          Iniciar Sesión 🐷
        </h1>

        <input
          type="email"
          placeholder="Correo"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full border p-2 rounded mb-4"
        />

        <input
          type="password"
          placeholder="Contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full border p-2 rounded mb-4"
        />

        {error && <p className="text-red-600 text-sm mb-3">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-red-600 text-white py-2 rounded disabled:opacity-60"
        >
          {loading ? "Ingresando..." : "Entrar"}
        </button>
      </form>
    </div>
  )
}
