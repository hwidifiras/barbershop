-- Allow French notifications independently of the dashboard interface language.
-- Existing supported notification locales (en, es, pt) plus French.

ALTER TABLE public.businesses
  DROP CONSTRAINT IF EXISTS businesses_notification_language_check;

ALTER TABLE public.businesses
  ADD CONSTRAINT businesses_notification_language_check
  CHECK (notification_language IN ('en', 'es', 'pt', 'fr'));
