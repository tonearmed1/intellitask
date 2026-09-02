-- Ensure the singleton settings row always exists.
INSERT INTO settings (id, ai_provider, ai_model, allow_web_research, theme, updated_at)
VALUES (1, 'mock', 'claude-sonnet-4-5', FALSE, 'system', to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
ON CONFLICT (id) DO NOTHING;
