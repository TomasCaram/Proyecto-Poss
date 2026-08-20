-- Cash adjustments (withdrawals, income corrections, etc.) from reports
CREATE TABLE cash_adjustments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  cash_register_id UUID REFERENCES cash_registers(id),
  type TEXT NOT NULL CHECK (type IN ('withdrawal', 'income', 'correction')),
  amount NUMERIC(12,2) NOT NULL,
  description TEXT NOT NULL,
  reference TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE cash_adjustments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_cash_adjustments" ON cash_adjustments FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_cash_adjustments" ON cash_adjustments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "update_cash_adjustments" ON cash_adjustments FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_cash_adjustments" ON cash_adjustments FOR DELETE TO authenticated USING (true);

CREATE INDEX idx_cash_adjustments_register ON cash_adjustments(cash_register_id);
CREATE INDEX idx_cash_adjustments_created ON cash_adjustments(created_at);
