-- S4: новые шаги анкеты (4 коротких экрана между profile_basic и profile_photos)
alter type onboarding_step add value if not exists 'profile_family';
alter type onboarding_step add value if not exists 'profile_values';
alter type onboarding_step add value if not exists 'profile_looking_for';
