-- ============================================
-- AUDITORÍA DE ACCIONES - BURITICA
-- Ejecutar en Supabase SQL Editor
-- ============================================

create table if not exists public.auditoria (
  id bigint generated always as identity primary key,
  usuario_id uuid null,
  modulo text not null,
  accion text not null,
  entidad text not null,
  entidad_id text null,
  descripcion text null,
  metadata jsonb null,
  created_at timestamp with time zone default now()
);

create index if not exists idx_auditoria_usuario_id on public.auditoria(usuario_id);
create index if not exists idx_auditoria_modulo on public.auditoria(modulo);
create index if not exists idx_auditoria_created_at on public.auditoria(created_at desc);

alter table public.auditoria enable row level security;

drop policy if exists auditoria_insert_editor on public.auditoria;
create policy auditoria_insert_editor
on public.auditoria
for insert
to authenticated
with check (
  exists (
    select 1
    from public.usuarios u
    where u.id = auth.uid()
      and u.estado = 'activo'
      and u.rol in ('admin', 'operador')
  )
);

drop policy if exists auditoria_select_admin on public.auditoria;
create policy auditoria_select_admin
on public.auditoria
for select
to authenticated
using (
  exists (
    select 1
    from public.usuarios u
    where u.id = auth.uid()
      and u.estado = 'activo'
      and u.rol = 'admin'
  )
);
