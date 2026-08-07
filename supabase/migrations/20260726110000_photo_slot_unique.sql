-- Ревью: слот фото держался только check-then-insert в приложении — гонка
-- (двойной тап / медленная мобильная загрузка) могла создать два фото одного
-- типа и увести юзера за MAX_PHOTOS. Инвариант «один слот на тип» теперь
-- подпёрт БД, как и остальные инварианты проекта.
--
-- rejected-фото ИСКЛЮЧЕНЫ из индекса: после отклонения модератором юзер обязан
-- иметь возможность загрузить замену в тот же слот.

-- Дедуп на случай, если гонка уже успела оставить дубли: оставляем самое свежее
-- не-rejected фото каждого типа, лишние помечаем rejected (не удаляем — файлы и
-- история модерации сохраняются).
update profile_photos p
   set status = 'rejected'
 where p.status <> 'rejected'
   and exists (
     select 1 from profile_photos q
      where q.user_id = p.user_id
        and q.photo_type = p.photo_type
        and q.status <> 'rejected'
        and (q.created_at, q.id) > (p.created_at, p.id)
   );

create unique index if not exists profile_photos_one_per_type
  on profile_photos (user_id, photo_type)
  where status <> 'rejected';

do $$ begin raise notice 'photo slot uniqueness enforced (one non-rejected photo per type).'; end $$;
