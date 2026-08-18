-- ============================================================================
-- Subtile — Supabase / Postgres Schema
-- نفّذ هذا الملف مرة واحدة في SQL Editor على Supabase (أو عبر vercel postgres)
-- ============================================================================

-- جدول المستخدمين (يُستخدم إن لم تُفعّلوا Supabase Auth مباشرة)
create table if not exists users (
  id            uuid primary key default gen_random_uuid(),
  username      text unique not null,
  email         text unique not null,
  password_hash text not null,
  avatar_url    text,
  created_at    timestamptz not null default now()
);

-- الأعمال (أفلام/مسلسلات) المعروفة محلياً — تُستخدم للبحث الهجين في api/search.js
create table if not exists media_titles (
  id           uuid primary key default gen_random_uuid(),
  tmdb_id      text unique not null,
  imdb_id      text,
  title        text not null,
  arabic_title text,
  type         text not null check (type in ('movie', 'tv')),
  year         int,
  poster       text,
  rating       numeric(3,1),
  created_at   timestamptz not null default now()
);

-- ترجمات مرفوعة من المستخدمين
create table if not exists subtitles (
  id            uuid primary key default gen_random_uuid(),
  media_id      uuid references media_titles(id) on delete cascade,
  uploader_id   uuid references users(id) on delete set null,
  language      text not null check (language in ('ar', 'en')),
  release_name  text not null,
  quality       text,
  season        int,
  episode       int,
  format        text not null default 'SRT',
  file_url      text not null,      -- مسار التخزين (Supabase Storage) أو رابط خارجي
  downloads     int not null default 0,
  hearing_impaired boolean not null default false,
  fps           text,
  status        text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at    timestamptz not null default now()
);

-- سجل عمليات التحميل — للإحصائيات و"الأكثر تحميلاً"
create table if not exists downloads_log (
  id           uuid primary key default gen_random_uuid(),
  subtitle_id  uuid references subtitles(id) on delete cascade,
  user_id      uuid references users(id) on delete set null,
  ip_hash      text,               -- تجزئة الـ IP فقط (لا نخزّن IP خام)
  downloaded_at timestamptz not null default now()
);

create index if not exists idx_subtitles_media on subtitles(media_id);
create index if not exists idx_subtitles_created on subtitles(created_at desc);
create index if not exists idx_downloads_subtitle on downloads_log(subtitle_id);

-- ============================================================================
-- استعلامات جاهزة للصفحة الرئيسية
-- ============================================================================

-- أحدث الترجمات المرفوعة (لعرضها في جدول "أحدث الترجمات")
-- select s.*, m.title, m.arabic_title, m.poster, m.year, m.type
-- from subtitles s
-- join media_titles m on m.id = s.media_id
-- where s.status = 'approved'
-- order by s.created_at desc
-- limit 20;

-- الأكثر تحميلاً هذا الأسبوع
-- select s.*, m.title, m.arabic_title, m.poster,
--        count(d.id) as recent_downloads
-- from subtitles s
-- join media_titles m on m.id = s.media_id
-- left join downloads_log d on d.subtitle_id = s.id and d.downloaded_at > now() - interval '7 days'
-- where s.status = 'approved'
-- group by s.id, m.id
-- order by recent_downloads desc
-- limit 10;
