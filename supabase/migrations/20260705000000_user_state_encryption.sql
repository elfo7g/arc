-- Column-level at-rest encryption for user_state.data.
--
-- Supabase's underlying storage is already disk-encrypted by default; that
-- part isn't something a migration toggles. This adds defense-in-depth on
-- top of it: a raw pg_dump / leaked backup / compromised read-only role no
-- longer exposes plaintext journal, memory, and chapter content.
--
-- True end-to-end (zero-knowledge) encryption isn't possible here because
-- the Nilo Edge Function has to read plaintext to send it to Gemini, so the
-- key has to live server-side. This trades that off honestly: the key is
-- reachable only from SECURITY DEFINER functions, never from client roles.

create extension if not exists pgcrypto with schema extensions;
create extension if not exists supabase_vault;

do $$
begin
  if not exists (select 1 from vault.secrets where name = 'user_state_key') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'user_state_key');
  end if;
end $$;

create or replace function public.user_state_key()
returns text
language sql
security definer
set search_path = vault
as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'user_state_key';
$$;

revoke all on function public.user_state_key() from public, anon, authenticated;

-- Move existing plaintext into an encrypted column, then swap it in.
alter table public.user_state add column data_enc bytea;

update public.user_state
set data_enc = extensions.pgp_sym_encrypt(data::text, public.user_state_key());

alter table public.user_state alter column data_enc set not null;
alter table public.user_state drop column data;
alter table public.user_state rename column data_enc to data;

-- Client access now goes through these two functions instead of the table
-- directly, so encryption/decryption always happens with the vaulted key.
create or replace function public.get_user_state()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  select extensions.pgp_sym_decrypt(data, public.user_state_key())::jsonb
  into result
  from public.user_state
  where user_id = auth.uid();
  return result;
end;
$$;

create or replace function public.set_user_state(p_data jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_state (user_id, data)
  values (auth.uid(), extensions.pgp_sym_encrypt(p_data::text, public.user_state_key()))
  on conflict (user_id) do update
    set data = excluded.data;
end;
$$;

revoke all on function public.get_user_state() from public, anon;
revoke all on function public.set_user_state(jsonb) from public, anon;
grant execute on function public.get_user_state() to authenticated;
grant execute on function public.set_user_state(jsonb) to authenticated;

-- The RLS policies from the previous migration stay in place as a second
-- layer, but direct table access is no longer how the client reads/writes:
-- ciphertext without the vaulted key is useless to it anyway.
revoke select, insert, update, delete on public.user_state from authenticated, anon;
