-- ═══════════════════════════════════════════════════════════
-- SYSTEM METADATA: Generic Cache for Economic Calendar & Others
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.system_metadata (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

COMMENT ON TABLE public.system_metadata IS 'Caché persistente para metadatos del sistema (ej: calendario económico)';

-- Initial empty mirror key
INSERT INTO public.system_metadata (key, value) 
VALUES ('economic_calendar_mirror', '')
ON CONFLICT (key) DO NOTHING;
