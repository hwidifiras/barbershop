-- Allow French notifications independently of the dashboard interface language.
-- Keep the existing supported notification locales and add Italian and French.

ALTER TABLE public.businesses
  DROP CONSTRAINT IF EXISTS businesses_notification_language_check;

ALTER TABLE public.businesses
  ADD CONSTRAINT businesses_notification_language_check
  CHECK (notification_language IN ('en', 'es', 'it', 'pt', 'fr'));
