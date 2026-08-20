-- Categories
CREATE TABLE categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Products
CREATE TABLE products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  barcode TEXT UNIQUE,
  category_id UUID REFERENCES categories(id),
  sale_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  cost_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  stock INTEGER NOT NULL DEFAULT 0,
  image_url TEXT,
  is_active BOOLEAN DEFAULT true,
  is_quick_access BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Promotions
CREATE TABLE promotions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('buy_x_get_y', 'quantity_discount', 'combo', 'pack_price')),
  buy_quantity INTEGER NOT NULL DEFAULT 1,
  get_quantity INTEGER NOT NULL DEFAULT 0,
  discount_percent NUMERIC(5,2) DEFAULT 0,
  discount_fixed NUMERIC(12,2) DEFAULT 0,
  pack_price NUMERIC(12,2) DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  start_date DATE,
  end_date DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Promotion products (which products are part of a promotion)
CREATE TABLE promotion_products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  promotion_id UUID NOT NULL REFERENCES promotions(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(promotion_id, product_id)
);

-- Cash register openings
CREATE TABLE cash_registers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  opening_amount NUMERIC(12,2) NOT NULL,
  closing_amount NUMERIC(12,2),
  counted_amount NUMERIC(12,2),
  difference NUMERIC(12,2),
  opened_at TIMESTAMPTZ DEFAULT now(),
  closed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  notes TEXT
);

-- Cash movements (income/expense)
CREATE TABLE cash_movements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cash_register_id UUID NOT NULL REFERENCES cash_registers(id),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  amount NUMERIC(12,2) NOT NULL,
  description TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Sales
CREATE TABLE sales (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  cash_register_id UUID REFERENCES cash_registers(id),
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'cancelled', 'returned')),
  sale_date TIMESTAMPTZ DEFAULT now(),
  customer_name TEXT,
  notes TEXT
);

-- Sale details
CREATE TABLE sale_details (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC(12,2) NOT NULL,
  discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  subtotal NUMERIC(12,2) NOT NULL,
  promotion_id UUID REFERENCES promotions(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Payments
CREATE TABLE payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  method TEXT NOT NULL CHECK (method IN ('cash', 'debit', 'credit', 'transfer', 'mercadopago', 'mixed')),
  amount NUMERIC(12,2) NOT NULL,
  reference TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Mixed payment details
CREATE TABLE mixed_payment_details (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  method TEXT NOT NULL CHECK (method IN ('cash', 'debit', 'credit', 'transfer', 'mercadopago')),
  amount NUMERIC(12,2) NOT NULL,
  reference TEXT
);

-- Audit log
CREATE TABLE audit_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE promotion_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_registers ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE mixed_payment_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies for categories
CREATE POLICY "select_categories" ON categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_categories" ON categories FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "update_categories" ON categories FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_categories" ON categories FOR DELETE TO authenticated USING (true);

-- RLS Policies for products
CREATE POLICY "select_products" ON products FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_products" ON products FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "update_products" ON products FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_products" ON products FOR DELETE TO authenticated USING (true);

-- RLS Policies for promotions
CREATE POLICY "select_promotions" ON promotions FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_promotions" ON promotions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "update_promotions" ON promotions FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_promotions" ON promotions FOR DELETE TO authenticated USING (true);

-- RLS Policies for promotion_products
CREATE POLICY "select_promotion_products" ON promotion_products FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_promotion_products" ON promotion_products FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "update_promotion_products" ON promotion_products FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_promotion_products" ON promotion_products FOR DELETE TO authenticated USING (true);

-- RLS Policies for cash_registers
CREATE POLICY "select_cash_registers" ON cash_registers FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_cash_registers" ON cash_registers FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "update_cash_registers" ON cash_registers FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_cash_registers" ON cash_registers FOR DELETE TO authenticated USING (true);

-- RLS Policies for cash_movements
CREATE POLICY "select_cash_movements" ON cash_movements FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_cash_movements" ON cash_movements FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "update_cash_movements" ON cash_movements FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_cash_movements" ON cash_movements FOR DELETE TO authenticated USING (true);

-- RLS Policies for sales
CREATE POLICY "select_sales" ON sales FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_sales" ON sales FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "update_sales" ON sales FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_sales" ON sales FOR DELETE TO authenticated USING (true);

-- RLS Policies for sale_details
CREATE POLICY "select_sale_details" ON sale_details FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_sale_details" ON sale_details FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "update_sale_details" ON sale_details FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_sale_details" ON sale_details FOR DELETE TO authenticated USING (true);

-- RLS Policies for payments
CREATE POLICY "select_payments" ON payments FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_payments" ON payments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "update_payments" ON payments FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_payments" ON payments FOR DELETE TO authenticated USING (true);

-- RLS Policies for mixed_payment_details
CREATE POLICY "select_mixed_payment_details" ON mixed_payment_details FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_mixed_payment_details" ON mixed_payment_details FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "update_mixed_payment_details" ON mixed_payment_details FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_mixed_payment_details" ON mixed_payment_details FOR DELETE TO authenticated USING (true);

-- RLS Policies for audit_log
CREATE POLICY "select_audit_log" ON audit_log FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_audit_log" ON audit_log FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "update_audit_log" ON audit_log FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_audit_log" ON audit_log FOR DELETE TO authenticated USING (true);

-- Indexes for performance
CREATE INDEX idx_products_barcode ON products(barcode);
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_name ON products USING gin(to_tsvector('spanish', name));
CREATE INDEX idx_sales_date ON sales(sale_date);
CREATE INDEX idx_sales_user ON sales(user_id);
CREATE INDEX idx_sale_details_sale ON sale_details(sale_id);
CREATE INDEX idx_sale_details_product ON sale_details(product_id);
CREATE INDEX idx_payments_sale ON payments(sale_id);
CREATE INDEX idx_cash_registers_user ON cash_registers(user_id);
CREATE INDEX idx_cash_registers_status ON cash_registers(status);
CREATE INDEX idx_audit_log_created ON audit_log(created_at);
CREATE INDEX idx_audit_log_entity ON audit_log(entity_type, entity_id);
CREATE INDEX idx_cash_movements_register ON cash_movements(cash_register_id);

-- Updated at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_categories_updated_at BEFORE UPDATE ON categories FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_promotions_updated_at BEFORE UPDATE ON promotions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Auto-insert audit log trigger
CREATE OR REPLACE FUNCTION log_audit_trigger()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO audit_log (user_id, action, entity_type, entity_id, details)
    VALUES (auth.uid(), 'INSERT', TG_TABLE_NAME, NEW.id, to_jsonb(NEW));
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO audit_log (user_id, action, entity_type, entity_id, details)
    VALUES (auth.uid(), 'UPDATE', TG_TABLE_NAME, NEW.id, jsonb_build_object('old', to_jsonb(OLD), 'new', to_jsonb(NEW)));
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO audit_log (user_id, action, entity_type, entity_id, details)
    VALUES (auth.uid(), 'DELETE', TG_TABLE_NAME, OLD.id, to_jsonb(OLD));
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER audit_products AFTER INSERT OR UPDATE OR DELETE ON products FOR EACH ROW EXECUTE FUNCTION log_audit_trigger();
CREATE TRIGGER audit_categories AFTER INSERT OR UPDATE OR DELETE ON categories FOR EACH ROW EXECUTE FUNCTION log_audit_trigger();
CREATE TRIGGER audit_promotions AFTER INSERT OR UPDATE OR DELETE ON promotions FOR EACH ROW EXECUTE FUNCTION log_audit_trigger();
CREATE TRIGGER audit_sales AFTER INSERT OR UPDATE OR DELETE ON sales FOR EACH ROW EXECUTE FUNCTION log_audit_trigger();
