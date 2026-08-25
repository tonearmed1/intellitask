-- Ensure the singleton settings row always exists.
INSERT INTO settings (id, ai_provider, ai_model, allow_web_research, theme)
VALUES (1, 'mock', 'claude-sonnet-4-5', 0, 'system')
ON CONFLICT(id) DO NOTHING;
