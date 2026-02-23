import { supabase } from "../lib/supabase"
import { createClient } from "@supabase/supabase-js"
import { registrarAuditoria } from "./auditService"

let adminCreateClient = null

const getAdminCreateClient = () => {
  if (adminCreateClient) return adminCreateClient

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

  adminCreateClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storageKey: "sb-admin-create-user"
    }
  })

  return adminCreateClient
}

const getActorId = async () => {
  const { data } = await supabase.auth.getUser()
  return data?.user?.id || null
}

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
    // Usuario ya existe
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

  const actorId = await getActorId()
  await registrarAuditoria({
    usuarioId: actorId,
    modulo: "usuarios",
    accion: "update_rol",
    entidad: "usuarios",
    entidadId: String(userId),
    descripcion: `Actualizó rol a ${role}`,
    metadata: { role }
  })

  return data
}

export const updateUserStatus = async (userId, status) => {
  const { data, error } = await supabase
    .from("usuarios")
    .update({ estado: status })
    .eq("id", userId)
    .select()
    .single()

  if (error) {
    console.error("Error updating user status:", error)
    return null
  }

  const actorId = await getActorId()
  await registrarAuditoria({
    usuarioId: actorId,
    modulo: "usuarios",
    accion: "update_estado",
    entidad: "usuarios",
    entidadId: String(userId),
    descripcion: `Actualizó estado a ${status}`,
    metadata: { status }
  })

  return data
}

export const listUsers = async () => {
  const { data, error } = await supabase
    .from("usuarios")
    .select("id, email, nombre, rol, estado, created_at")
    .order("created_at", { ascending: false })

  if (error) {
    console.error("Error listing users:", error)
    return null
  }

  return data
}

export const createUserFromAdmin = async ({ email, password, nombre, rol, estado }) => {
  const isolatedClient = getAdminCreateClient()

  const { data: signUpData, error: signUpError } = await isolatedClient.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${window.location.origin}/auth/callback`,
      data: {
        full_name: nombre
      }
    }
  })

  if (signUpError) {
    console.error("Error creating auth user:", signUpError)
    return { error: signUpError.message }
  }

  const authUserId = signUpData?.user?.id
  if (!authUserId) {
    console.error("Error creating auth user: missing user id")
    return { error: "No se recibió el id del usuario creado" }
  }

  const { data, error } = await supabase
    .from("usuarios")
    .upsert(
      [
        {
          id: authUserId,
          email,
          nombre,
          rol,
          estado
        }
      ],
      { onConflict: "id" }
    )
    .select()
    .single()

  if (error) {
    console.error("Error creating user profile:", error)
    return { error: error.message }
  }

  const actorId = await getActorId()
  await registrarAuditoria({
    usuarioId: actorId,
    modulo: "usuarios",
    accion: "create",
    entidad: "usuarios",
    entidadId: String(authUserId),
    descripcion: `Creó usuario ${email}`,
    metadata: { email, nombre, rol, estado }
  })

  return {
    data,
    requiresEmailConfirmation: !signUpData?.user?.email_confirmed_at
  }
}

export const deleteUserProfile = async (userId) => {
  const actorId = await getActorId()

  const { error } = await supabase.rpc("admin_delete_user", { target_user_id: userId })

  if (error) {
    console.error("Error deleting user completely:", error)
    return false
  }

  await registrarAuditoria({
    usuarioId: actorId,
    modulo: "usuarios",
    accion: "delete",
    entidad: "usuarios",
    entidadId: String(userId),
    descripcion: "Eliminó usuario de auth y perfil"
  })

  return true
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
