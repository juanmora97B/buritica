const EDIT_ROLES = ["admin", "operador"]

export const canEditByRole = (role) => EDIT_ROLES.includes(role)

export const canManageUsersByRole = (role) => role === "admin"