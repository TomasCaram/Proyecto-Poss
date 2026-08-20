export interface Category {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  name: string;
  barcode: string | null;
  category_id: string | null;
  sale_price: number;
  cost_price: number;
  stock: number;
  image_url: string | null;
  is_active: boolean;
  is_quick_access: boolean;
  created_at: string;
  updated_at: string;
  categories?: Category;
}

export interface Promotion {
  id: string;
  name: string;
  type: 'buy_x_get_y' | 'quantity_discount' | 'combo' | 'pack_price';
  buy_quantity: number;
  get_quantity: number;
  discount_percent: number;
  discount_fixed: number;
  pack_price: number;
  is_active: boolean;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  updated_at: string;
  promotion_products?: PromotionProduct[];
}

export interface PromotionProduct {
  id: string;
  promotion_id: string;
  product_id: string;
  products?: Product;
}

export interface CashRegister {
  id: string;
  user_id: string;
  opening_amount: number;
  closing_amount: number | null;
  counted_amount: number | null;
  difference: number | null;
  opened_at: string;
  closed_at: string | null;
  status: 'open' | 'closed';
  notes: string | null;
}

export interface CashMovement {
  id: string;
  cash_register_id: string;
  user_id: string;
  type: 'income' | 'expense';
  amount: number;
  description: string;
  created_at: string;
}

export interface Sale {
  id: string;
  user_id: string;
  cash_register_id: string | null;
  subtotal: number;
  discount_amount: number;
  total: number;
  status: 'completed' | 'cancelled' | 'returned';
  sale_date: string;
  customer_name: string | null;
  notes: string | null;
  sale_details?: SaleDetail[];
  payments?: Payment[];
}

export interface SaleDetail {
  id: string;
  sale_id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  discount_amount: number;
  subtotal: number;
  promotion_id: string | null;
  created_at: string;
}

export interface Payment {
  id: string;
  sale_id: string;
  method: 'cash' | 'debit' | 'credit' | 'transfer' | 'mercadopago' | 'mixed';
  amount: number;
  reference: string | null;
  created_at: string;
  mixed_payment_details?: MixedPaymentDetail[];
}

export interface MixedPaymentDetail {
  id: string;
  payment_id: string;
  method: 'cash' | 'debit' | 'credit' | 'transfer' | 'mercadopago';
  amount: number;
  reference: string | null;
}

export interface AuditLog {
  id: string;
  user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
  unit_price: number;
  discount_amount: number;
  subtotal: number;
  promotion_id: string | null;
}

export interface CashAdjustment {
  id: string;
  user_id: string;
  cash_register_id: string | null;
  type: 'withdrawal' | 'income' | 'correction';
  amount: number;
  description: string;
  reference: string | null;
  created_at: string;
}

export interface UserProfile {
  id: string;
  email: string;
  full_name?: string;
}
