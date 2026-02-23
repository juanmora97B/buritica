-- ============================================
-- ROLES Y PERMISOS (RLS) - BURITICA
-- admin / operador: pueden editar
-- vendedor: solo lectura
-- ============================================

-- 1) Funciones helper de autorización
create or replace function public.es_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.usuarios u
    where u.id = auth.uid()
      and u.estado = 'activo'
      and u.rol = 'admin'
  );
$$;

create or replace function public.puede_editar()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.usuarios u
    where u.id = auth.uid()
      and u.estado = 'activo'
      and u.rol in ('admin', 'operador')
  );
$$;

grant execute on function public.es_admin() to authenticated;
grant execute on function public.puede_editar() to authenticated;

create or replace function public.admin_delete_user(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.es_admin() then
    raise exception 'No autorizado';
  end if;

  if target_user_id is null then
    raise exception 'target_user_id es requerido';
  end if;

  if target_user_id = auth.uid() then
    raise exception 'No puedes eliminar tu propio usuario';
  end if;

  delete from public.pagos where usuario_id = target_user_id;
  delete from public.gastos where usuario_id = target_user_id;
  delete from public.ventas where usuario_id = target_user_id;

  delete from public.usuarios where id = target_user_id;
  delete from auth.users where id = target_user_id;
end;
$$;

grant execute on function public.admin_delete_user(uuid) to authenticated;

-- 2) Usuarios: cada usuario ve su perfil; admin ve todos y gestiona roles/estado
alter table public.usuarios enable row level security;

drop policy if exists usuarios_select_self_or_admin on public.usuarios;
create policy usuarios_select_self_or_admin
on public.usuarios
for select
to authenticated
using (id = auth.uid() or public.es_admin());

drop policy if exists usuarios_insert_self on public.usuarios;
create policy usuarios_insert_self
on public.usuarios
for insert
to authenticated
with check (
  id = auth.uid()
  and coalesce(rol, 'operador') = 'operador'
  and coalesce(estado, 'activo') = 'activo'
);

drop policy if exists usuarios_insert_admin on public.usuarios;
create policy usuarios_insert_admin
on public.usuarios
for insert
to authenticated
with check (public.es_admin());

drop policy if exists usuarios_update_admin on public.usuarios;
create policy usuarios_update_admin
on public.usuarios
for update
to authenticated
using (public.es_admin())
with check (public.es_admin());

drop policy if exists usuarios_delete_admin on public.usuarios;
create policy usuarios_delete_admin
on public.usuarios
for delete
to authenticated
using (public.es_admin());

-- 3) Tablas de negocio: lectura para autenticados, edición solo admin/operador
-- Lista: cerdos, clientes, contacto_clientes, etiquetas_cerdos,
--        ventas, detalle_venta, ventas_libriado, pagos, gastos, movimientos_cerdos

alter table public.cerdos enable row level security;
alter table public.clientes enable row level security;
alter table public.contacto_clientes enable row level security;
alter table public.etiquetas_cerdos enable row level security;
alter table public.ventas enable row level security;
alter table public.detalle_venta enable row level security;
alter table public.ventas_libriado enable row level security;
alter table public.pagos enable row level security;
alter table public.gastos enable row level security;
alter table public.movimientos_cerdos enable row level security;

-- cerdos
 drop policy if exists cerdos_select_auth on public.cerdos;
 create policy cerdos_select_auth on public.cerdos for select to authenticated using (true);
 drop policy if exists cerdos_insert_edit on public.cerdos;
 create policy cerdos_insert_edit on public.cerdos for insert to authenticated with check (public.puede_editar());
 drop policy if exists cerdos_update_edit on public.cerdos;
 create policy cerdos_update_edit on public.cerdos for update to authenticated using (public.puede_editar()) with check (public.puede_editar());
 drop policy if exists cerdos_delete_edit on public.cerdos;
 create policy cerdos_delete_edit on public.cerdos for delete to authenticated using (public.puede_editar());

-- clientes
 drop policy if exists clientes_select_auth on public.clientes;
 create policy clientes_select_auth on public.clientes for select to authenticated using (true);
 drop policy if exists clientes_insert_edit on public.clientes;
 create policy clientes_insert_edit on public.clientes for insert to authenticated with check (public.puede_editar());
 drop policy if exists clientes_update_edit on public.clientes;
 create policy clientes_update_edit on public.clientes for update to authenticated using (public.puede_editar()) with check (public.puede_editar());
 drop policy if exists clientes_delete_edit on public.clientes;
 create policy clientes_delete_edit on public.clientes for delete to authenticated using (public.puede_editar());

-- contacto_clientes
 drop policy if exists contacto_clientes_select_auth on public.contacto_clientes;
 create policy contacto_clientes_select_auth on public.contacto_clientes for select to authenticated using (true);
 drop policy if exists contacto_clientes_insert_edit on public.contacto_clientes;
 create policy contacto_clientes_insert_edit on public.contacto_clientes for insert to authenticated with check (public.puede_editar());
 drop policy if exists contacto_clientes_update_edit on public.contacto_clientes;
 create policy contacto_clientes_update_edit on public.contacto_clientes for update to authenticated using (public.puede_editar()) with check (public.puede_editar());
 drop policy if exists contacto_clientes_delete_edit on public.contacto_clientes;
 create policy contacto_clientes_delete_edit on public.contacto_clientes for delete to authenticated using (public.puede_editar());

-- etiquetas_cerdos
 drop policy if exists etiquetas_cerdos_select_auth on public.etiquetas_cerdos;
 create policy etiquetas_cerdos_select_auth on public.etiquetas_cerdos for select to authenticated using (true);
 drop policy if exists etiquetas_cerdos_insert_edit on public.etiquetas_cerdos;
 create policy etiquetas_cerdos_insert_edit on public.etiquetas_cerdos for insert to authenticated with check (public.puede_editar());
 drop policy if exists etiquetas_cerdos_update_edit on public.etiquetas_cerdos;
 create policy etiquetas_cerdos_update_edit on public.etiquetas_cerdos for update to authenticated using (public.puede_editar()) with check (public.puede_editar());
 drop policy if exists etiquetas_cerdos_delete_edit on public.etiquetas_cerdos;
 create policy etiquetas_cerdos_delete_edit on public.etiquetas_cerdos for delete to authenticated using (public.puede_editar());

-- ventas
 drop policy if exists ventas_select_auth on public.ventas;
 create policy ventas_select_auth on public.ventas for select to authenticated using (true);
 drop policy if exists ventas_insert_edit on public.ventas;
 create policy ventas_insert_edit on public.ventas for insert to authenticated with check (public.puede_editar());
 drop policy if exists ventas_update_edit on public.ventas;
 create policy ventas_update_edit on public.ventas for update to authenticated using (public.puede_editar()) with check (public.puede_editar());
 drop policy if exists ventas_delete_edit on public.ventas;
 create policy ventas_delete_edit on public.ventas for delete to authenticated using (public.puede_editar());

-- detalle_venta
 drop policy if exists detalle_venta_select_auth on public.detalle_venta;
 create policy detalle_venta_select_auth on public.detalle_venta for select to authenticated using (true);
 drop policy if exists detalle_venta_insert_edit on public.detalle_venta;
 create policy detalle_venta_insert_edit on public.detalle_venta for insert to authenticated with check (public.puede_editar());
 drop policy if exists detalle_venta_update_edit on public.detalle_venta;
 create policy detalle_venta_update_edit on public.detalle_venta for update to authenticated using (public.puede_editar()) with check (public.puede_editar());
 drop policy if exists detalle_venta_delete_edit on public.detalle_venta;
 create policy detalle_venta_delete_edit on public.detalle_venta for delete to authenticated using (public.puede_editar());

-- ventas_libriado
 drop policy if exists ventas_libriado_select_auth on public.ventas_libriado;
 create policy ventas_libriado_select_auth on public.ventas_libriado for select to authenticated using (true);
 drop policy if exists ventas_libriado_insert_edit on public.ventas_libriado;
 create policy ventas_libriado_insert_edit on public.ventas_libriado for insert to authenticated with check (public.puede_editar());
 drop policy if exists ventas_libriado_update_edit on public.ventas_libriado;
 create policy ventas_libriado_update_edit on public.ventas_libriado for update to authenticated using (public.puede_editar()) with check (public.puede_editar());
 drop policy if exists ventas_libriado_delete_edit on public.ventas_libriado;
 create policy ventas_libriado_delete_edit on public.ventas_libriado for delete to authenticated using (public.puede_editar());

-- pagos
 drop policy if exists pagos_select_auth on public.pagos;
 create policy pagos_select_auth on public.pagos for select to authenticated using (true);
 drop policy if exists pagos_insert_edit on public.pagos;
 create policy pagos_insert_edit on public.pagos for insert to authenticated with check (public.puede_editar());
 drop policy if exists pagos_update_edit on public.pagos;
 create policy pagos_update_edit on public.pagos for update to authenticated using (public.puede_editar()) with check (public.puede_editar());
 drop policy if exists pagos_delete_edit on public.pagos;
 create policy pagos_delete_edit on public.pagos for delete to authenticated using (public.puede_editar());

-- gastos
 drop policy if exists gastos_select_auth on public.gastos;
 create policy gastos_select_auth on public.gastos for select to authenticated using (true);
 drop policy if exists gastos_insert_edit on public.gastos;
 create policy gastos_insert_edit on public.gastos for insert to authenticated with check (public.puede_editar());
 drop policy if exists gastos_update_edit on public.gastos;
 create policy gastos_update_edit on public.gastos for update to authenticated using (public.puede_editar()) with check (public.puede_editar());
 drop policy if exists gastos_delete_edit on public.gastos;
 create policy gastos_delete_edit on public.gastos for delete to authenticated using (public.puede_editar());

-- movimientos_cerdos
 drop policy if exists movimientos_cerdos_select_auth on public.movimientos_cerdos;
 create policy movimientos_cerdos_select_auth on public.movimientos_cerdos for select to authenticated using (true);
 drop policy if exists movimientos_cerdos_insert_edit on public.movimientos_cerdos;
 create policy movimientos_cerdos_insert_edit on public.movimientos_cerdos for insert to authenticated with check (public.puede_editar());
 drop policy if exists movimientos_cerdos_update_edit on public.movimientos_cerdos;
 create policy movimientos_cerdos_update_edit on public.movimientos_cerdos for update to authenticated using (public.puede_editar()) with check (public.puede_editar());
 drop policy if exists movimientos_cerdos_delete_edit on public.movimientos_cerdos;
 create policy movimientos_cerdos_delete_edit on public.movimientos_cerdos for delete to authenticated using (public.puede_editar());

-- ============================================
-- Uso sugerido:
-- 1) Ejecuta este archivo en Supabase SQL Editor.
-- 2) En public.usuarios, deja a tus jefes como admin y operarios como operador.
-- 3) Los vendedores quedarán solo lectura automáticamente.
-- ============================================
