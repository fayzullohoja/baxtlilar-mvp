-- B1 (аудит): фото профиля больше НЕ публичны. Отдаём только через подписанные URL
-- с коротким TTL (см. lib/uploads/storage.ts signedPhotoUrl/signedPhotoUrls), чтобы серверные
-- гейты (published/approved/active/block) реально управляли доступом к лицам пользователей.
update storage.buckets set public = false where id = 'profile-photos';
