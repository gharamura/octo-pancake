-- Rename COA account types:
--   equity    → transfer
--   asset     → investment
--   liability → investment  (merge asset + liability into investment)

UPDATE coa_accounts SET type = 'transfer'   WHERE type = 'equity';
UPDATE coa_accounts SET type = 'investment' WHERE type = 'asset';
UPDATE coa_accounts SET type = 'investment' WHERE type = 'liability';
