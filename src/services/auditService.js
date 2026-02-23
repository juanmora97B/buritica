import { supabase } from "../lib/supabase"

export const registrarAuditoria = async ({
  usuarioId = null,
  modulo,
  accion,
  entidad,
  entidadId = null,
  descripcion = null,
  metadata = null
}) => {
  if (!supabase) return

  const payload = {
    usuario_id: usuarioId,
    modulo,
    accion,
    entidad,
    entidad_id: entidadId,
    descripcion,
    metadata
  }

  const { error } = await supabase.from("auditoria").insert([payload])

  if (error) {
    console.error("Error registrando auditoría:", error)
  }
}
