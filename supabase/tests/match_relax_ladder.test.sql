-- MATCH-1 — degradation ladder в get_recommendations(p_viewer, p_limit, p_relax_level).
-- Level 0 = strict (текущее поведение). Level 1 = возрастное окно зрителя ±5 лет
-- (floor 18 — никогда ниже). Level 2 = + снимается candidate-side возрастная
-- преференция. ВСЕ остальные фильтры инвариантны на каждом уровне: lifecycle
-- active, verification approved, published, взаимный пол, наличие approved-фото,
-- match_views dedup, blocks, existing-request. Return несёт relax_level.

begin;

do $$
declare
  viewer uuid; viewer2 uuid;
  a uuid; b uuid; c uuid; d uuid; e uuid; f uuid; g uuid; h uuid;
  h18 uuid; h16 uuid;
  n int;
begin
  -- ===== viewer: м, 30 лет, ищет ж СТРОГО 25-25 =====
  insert into users (telegram_id, verification_status, lifecycle_state)
    values (990009400, 'approved', 'active') returning id into viewer;
  insert into user_profiles (user_id, gender, looking_for_gender, birth_date, partner_age_min, partner_age_max, status)
    values (viewer, 'm', 'f', (current_date - interval '30 years' - interval '100 days')::date, 25, 25, 'published');

  -- A: ж 25, prefs 25-35 (viewer 30 проходит) + фото → strict-кандидат
  insert into users (telegram_id, verification_status, lifecycle_state)
    values (990009401, 'approved', 'active') returning id into a;
  insert into user_profiles (user_id, gender, looking_for_gender, birth_date, partner_age_min, partner_age_max, status)
    values (a, 'f', 'm', (current_date - interval '25 years' - interval '100 days')::date, 25, 35, 'published');
  insert into profile_photos (user_id, path, status, is_main) values (a, 'p/a.jpg', 'approved', true);

  -- B: ж 30 (вне строгого 25-25, но в 25±5), prefs 25-35 → появляется на level 1
  insert into users (telegram_id, verification_status, lifecycle_state)
    values (990009402, 'approved', 'active') returning id into b;
  insert into user_profiles (user_id, gender, looking_for_gender, birth_date, partner_age_min, partner_age_max, status)
    values (b, 'f', 'm', (current_date - interval '30 years' - interval '100 days')::date, 25, 35, 'published');
  insert into profile_photos (user_id, path, status, is_main) values (b, 'p/b.jpg', 'approved', true);

  -- C: ж 30, но её prefs 40-50 НЕ покрывают viewer(30) → только level 2
  insert into users (telegram_id, verification_status, lifecycle_state)
    values (990009403, 'approved', 'active') returning id into c;
  insert into user_profiles (user_id, gender, looking_for_gender, birth_date, partner_age_min, partner_age_max, status)
    values (c, 'f', 'm', (current_date - interval '30 years' - interval '100 days')::date, 40, 50, 'published');
  insert into profile_photos (user_id, path, status, is_main) values (c, 'p/c.jpg', 'approved', true);

  -- D: как B, но БЕЗ approved-фото → инвариант: нет ни на одном уровне
  insert into users (telegram_id, verification_status, lifecycle_state)
    values (990009404, 'approved', 'active') returning id into d;
  insert into user_profiles (user_id, gender, looking_for_gender, birth_date, partner_age_min, partner_age_max, status)
    values (d, 'f', 'm', (current_date - interval '30 years' - interval '100 days')::date, 25, 35, 'published');

  -- E: как B + фото, но заблокирована зрителем → инвариант
  insert into users (telegram_id, verification_status, lifecycle_state)
    values (990009405, 'approved', 'active') returning id into e;
  insert into user_profiles (user_id, gender, looking_for_gender, birth_date, partner_age_min, partner_age_max, status)
    values (e, 'f', 'm', (current_date - interval '30 years' - interval '100 days')::date, 25, 35, 'published');
  insert into profile_photos (user_id, path, status, is_main) values (e, 'p/e.jpg', 'approved', true);
  insert into blocks (blocker_id, blocked_id) values (viewer, e);

  -- F: как B + фото, но pending_review → инвариант
  insert into users (telegram_id, verification_status, lifecycle_state)
    values (990009406, 'pending_review', 'active') returning id into f;
  insert into user_profiles (user_id, gender, looking_for_gender, birth_date, partner_age_min, partner_age_max, status)
    values (f, 'f', 'm', (current_date - interval '30 years' - interval '100 days')::date, 25, 35, 'published');
  insert into profile_photos (user_id, path, status, is_main) values (f, 'p/f.jpg', 'approved', true);

  -- G: тот же пол, что viewer → взаимный пол инвариантен на level 2
  insert into users (telegram_id, verification_status, lifecycle_state)
    values (990009407, 'approved', 'active') returning id into g;
  insert into user_profiles (user_id, gender, looking_for_gender, birth_date, partner_age_min, partner_age_max, status)
    values (g, 'm', 'f', (current_date - interval '30 years' - interval '100 days')::date, 25, 35, 'published');
  insert into profile_photos (user_id, path, status, is_main) values (g, 'p/g.jpg', 'approved', true);

  -- H: как B + фото, но уже просмотрена (match_views) → dedup инвариантен
  insert into users (telegram_id, verification_status, lifecycle_state)
    values (990009408, 'approved', 'active') returning id into h;
  insert into user_profiles (user_id, gender, looking_for_gender, birth_date, partner_age_min, partner_age_max, status)
    values (h, 'f', 'm', (current_date - interval '30 years' - interval '100 days')::date, 25, 35, 'published');
  insert into profile_photos (user_id, path, status, is_main) values (h, 'p/h.jpg', 'approved', true);
  insert into match_views (viewer_id, target_id) values (viewer, h);

  -- ===== level 0: только A, relax_level=0 =====
  select count(*) into n from get_recommendations(viewer, 50, 0);
  if n <> 1 then raise exception 'level 0: ожидался 1 кандидат, получено %', n; end if;
  perform 1 from get_recommendations(viewer, 50, 0) r where r.user_id = a and r.relax_level = 0;
  if not found then raise exception 'level 0: ожидалась A с relax_level=0'; end if;

  -- дефолт p_relax_level=0: сигнатура с 2 аргументами работает как strict
  select count(*) into n from get_recommendations(viewer, 50);
  if n <> 1 then raise exception 'default relax: ожидался strict-результат (1), получено %', n; end if;

  -- ===== level 1: A + B (окно 20-30), C ещё нет (её prefs не покрывают) =====
  select count(*) into n from get_recommendations(viewer, 50, 1);
  if n <> 2 then raise exception 'level 1: ожидалось 2 кандидата, получено %', n; end if;
  perform 1 from get_recommendations(viewer, 50, 1) r where r.user_id = b and r.relax_level = 1;
  if not found then raise exception 'level 1: ожидалась B с relax_level=1'; end if;
  perform 1 from get_recommendations(viewer, 50, 1) r where r.user_id = c;
  if found then raise exception 'level 1: C не должна попадать (её prefs не покрывают viewer)'; end if;

  -- ===== level 2: + C (candidate-side prefs сняты); инварианты держатся =====
  select count(*) into n from get_recommendations(viewer, 50, 2);
  if n <> 3 then raise exception 'level 2: ожидалось 3 кандидата, получено %', n; end if;
  perform 1 from get_recommendations(viewer, 50, 2) r where r.user_id = c and r.relax_level = 2;
  if not found then raise exception 'level 2: ожидалась C с relax_level=2'; end if;
  perform 1 from get_recommendations(viewer, 50, 2) r where r.user_id in (d, e, f, g, h);
  if found then raise exception 'level 2: инварианты протекли (no-photo/blocked/pending/same-gender/viewed)'; end if;

  -- ===== floor 18: окно никогда не опускается ниже 18 =====
  -- viewer2: м 30, prefs 20-24 → level 1 даёт greatest(18, 15)..29
  insert into users (telegram_id, verification_status, lifecycle_state)
    values (990009410, 'approved', 'active') returning id into viewer2;
  insert into user_profiles (user_id, gender, looking_for_gender, birth_date, partner_age_min, partner_age_max, status)
    values (viewer2, 'm', 'f', (current_date - interval '30 years' - interval '100 days')::date, 20, 24, 'published');

  -- h18: ж 18, prefs 25-35 → на level 1 входит (18 >= floor)
  insert into users (telegram_id, verification_status, lifecycle_state)
    values (990009411, 'approved', 'active') returning id into h18;
  insert into user_profiles (user_id, gender, looking_for_gender, birth_date, partner_age_min, partner_age_max, status)
    values (h18, 'f', 'm', (current_date - interval '18 years' - interval '30 days')::date, 25, 35, 'published');
  insert into profile_photos (user_id, path, status, is_main) values (h18, 'p/h18.jpg', 'approved', true);

  -- h16: ж 16 — НИКОГДА не показывается, даже на level 2
  insert into users (telegram_id, verification_status, lifecycle_state)
    values (990009412, 'approved', 'active') returning id into h16;
  insert into user_profiles (user_id, gender, looking_for_gender, birth_date, partner_age_min, partner_age_max, status)
    values (h16, 'f', 'm', (current_date - interval '16 years' - interval '100 days')::date, 25, 35, 'published');
  insert into profile_photos (user_id, path, status, is_main) values (h16, 'p/h16.jpg', 'approved', true);

  perform 1 from get_recommendations(viewer2, 50, 1) r where r.user_id = h18;
  if not found then raise exception 'floor: 18-летняя должна входить на level 1'; end if;
  perform 1 from get_recommendations(viewer2, 50, 2) r where r.user_id = h16;
  if found then raise exception 'floor: 16-летняя не должна показываться ни на каком уровне'; end if;

  raise notice 'MATCH-1 relax ladder OK';
end $$;

rollback;
