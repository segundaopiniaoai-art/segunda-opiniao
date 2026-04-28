create or replace function public.create_specialist_prompt_version(
  p_specialist_id uuid,
  p_content text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_next_version int;
  v_new_id uuid;
begin
  if not public.is_admin() then
    raise exception 'unauthorized';
  end if;

  if p_content is null or length(trim(p_content)) = 0 then
    raise exception 'content is required';
  end if;

  select coalesce(max(version_number), 0) + 1
    into v_next_version
    from public.specialist_prompt_versions
   where specialist_id = p_specialist_id;

  insert into public.specialist_prompt_versions
    (specialist_id, version_number, content, created_by)
    values (p_specialist_id, v_next_version, p_content, auth.uid())
  returning id into v_new_id;

  update public.specialists
     set current_prompt_version_id = v_new_id
   where id = p_specialist_id;

  return v_new_id;
end;
$$;
