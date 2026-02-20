import { supabase } from "../lib/supabase"

// Obtener usuario actual desde auth
export const getCurrentUser = async () => {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.user ?? null
}

// Crear/actualizar usuario en tabla usuarios
export const syncUserProfile = async (user) => {
  if (!user) return null

  const { data: existingUser } = await supabase
    .from("usuarios")
    .select("*")
    .eq("id", user.id)
    .single()

  if (existingUser) {
    // Usuario ya existe, solo actualizar
    await supabase
      .from("usuarios")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", user.id)
    return existingUser
  }

  // Crear nuevo usuario
  const { data, error } = await supabase
    .from("usuarios")
    .insert([
      {
        id: user.id,
        email: user.email,
        nombre: user.user_metadata?.full_name || user.email.split("@")[0],
        rol: "operador", // Por defecto operador, admin debe cambiar en BD
        estado: "activo"
      }
    ])
    .select()
    .single()

  if (error) {
    console.error("Error creating user profile:", error)
    return null
  }

  return data
}

// Obtener perfil de usuario
export const getUserProfile = async (userId) => {
  const { data, error } = await supabase
    .from("usuarios")
    .select("*")
    .eq("id", userId)
    .single()

  if (error) {
    console.error("Error fetching user profile:", error)
    return null
  }

  return data
}

// Actualizar rol de usuario (solo admin)
export const updateUserRole = async (userId, role) => {
  const { data, error } = await supabase
    .from("usuarios")
    .update({ rol: role })
    .eq("id", userId)
    .select()
    .single()

  if (error) {
    console.error("Error updating user role:", error)
    return null
  }

  return data
}

// Logout
export const logout = async () => {
  const { error } = await supabase.auth.signOut()
  if (error) {
    console.error("Error logging out:", error)
    return false
  }
  return true
}
