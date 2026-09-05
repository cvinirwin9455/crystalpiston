-- ============================================================
-- Session Requests: multiple availability slots
-- ============================================================
-- When a client can't attend a session, instead of proposing a single
-- preferred time they can now offer up to 3 dates/times they ARE available.
-- The coach then makes a clear yes/no decision: accept one of the offered
-- slots (the session moves to it) or reject them all (the session is
-- cancelled and the client is asked to contact the coach).
--
-- We store the offered slots as a JSONB array of timezone-naive datetime
-- strings ("YYYY-MM-DDTHH:mm:00"). preferred_datetime is kept in sync with
-- the first slot for backward compatibility with existing code/dashboards.
-- ============================================================

ALTER TABLE public.session_requests
  ADD COLUMN IF NOT EXISTS preferred_slots JSONB;
