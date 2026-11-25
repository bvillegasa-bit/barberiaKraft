-- Reemplaza TU_EMAIL@ejemplo.com por el correo con el que inicias sesión y ejecuta en SQL Editor
alter table public.profiles disable trigger trg_prevent_role_change;
update public.profiles set rol = 'admin' where email = 'TU_EMAIL@ejemplo.com';
alter table public.profiles enable trigger trg_prevent_role_change;
select id, email, rol from public.profiles where rol = 'admin';
