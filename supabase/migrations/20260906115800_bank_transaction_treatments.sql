-- Extend bank transaction treatment semantics for capital purchases, tenant-deposit liabilities and cash extraction.
-- Additive classification values only; existing rows remain valid.

alter table public.bank_transactions
  drop constraint if exists bank_transactions_performance_treatment_check;

alter table public.bank_transactions
  add constraint bank_transactions_performance_treatment_check
  check (performance_treatment in ('auto', 'operating', 'company', 'investor', 'extraction', 'capital', 'liability', 'exclude'));
