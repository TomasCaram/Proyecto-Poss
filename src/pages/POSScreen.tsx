import { useState, useCallback, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { Product, CartItem, Promotion } from '../lib/types';
import ProductSearch from '../components/pos/ProductSearch';
import QuickProducts from '../components/pos/QuickProducts';
import CartPanel from '../components/pos/CartPanel';
import CheckoutModal from '../components/pos/CheckoutModal';

export default function POSScreen() {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCheckout, setShowCheckout] = useState(false);
  const [activePromotions, setActivePromotions] = useState<Promotion[]>([]);
  const [globalDiscount, setGlobalDiscount] = useState(0);

  const subtotal = cart.reduce((sum, item) => sum + item.subtotal, 0);
  const totalDiscount = cart.reduce((sum, item) => sum + item.discount_amount, 0);
  const total = Math.max(0, subtotal - globalDiscount);

  useEffect(() => {
    loadActivePromotions();
  }, []);

  const loadActivePromotions = async () => {
    const today = new Date().toISOString().split('T')[0];
    const { data } = await supabase
      .from('promotions')
      .select('*, promotion_products(*)')
      .eq('is_active', true)
      .or(`start_date.is.null,start_date.lte.${today}`)
      .or(`end_date.is.null,end_date.gte.${today}`);
    setActivePromotions(data ?? []);
  };

  const findApplicablePromotion = useCallback((product: Product, quantity: number): { promotion: Promotion; discount: number } | null => {
    for (const promo of activePromotions) {
      const productInPromo = promo.promotion_products?.some((pp) => pp.product_id === product.id);
      if (!productInPromo) continue;

      if (promo.type === 'buy_x_get_y' && quantity >= promo.buy_quantity) {
        const sets = Math.floor(quantity / promo.buy_quantity);
        const freeItems = sets * promo.get_quantity;
        const discount = freeItems * product.sale_price;
        return { promotion: promo, discount };
      }

      if (promo.type === 'quantity_discount' && quantity >= promo.buy_quantity) {
        const discount = product.sale_price * quantity * (promo.discount_percent / 100);
        return { promotion: promo, discount };
      }

      if (promo.type === 'pack_price' && quantity >= promo.buy_quantity) {
        const packs = Math.floor(quantity / promo.buy_quantity);
        const remaining = quantity % promo.buy_quantity;
        const packTotal = packs * promo.pack_price;
        const remainingTotal = remaining * product.sale_price;
        const normalTotal = quantity * product.sale_price;
        const discount = normalTotal - packTotal - remainingTotal;
        if (discount > 0) return { promotion: promo, discount };
      }
    }
    return null;
  }, [activePromotions]);

  const addProduct = useCallback((product: Product) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      const newQuantity = existing ? existing.quantity + 1 : 1;

      const promoResult = findApplicablePromotion(product, newQuantity);
      const discount = promoResult?.discount ?? 0;
      const promoId = promoResult?.promotion.id ?? null;

      const newItem: CartItem = {
        product,
        quantity: newQuantity,
        unit_price: product.sale_price,
        discount_amount: discount,
        subtotal: newQuantity * product.sale_price - discount,
        promotion_id: promoId,
      };

      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id ? newItem : item
        );
      }
      return [...prev, newItem];
    });
  }, [findApplicablePromotion]);

  const handleCheckoutComplete = useCallback(() => {
    setCart([]);
    setShowCheckout(false);
    setGlobalDiscount(0);
  }, []);

  return (
    <div className="h-full flex flex-col lg:flex-row">
      {/* Left: Products */}
      <div className="flex-1 flex flex-col p-4 lg:p-6 overflow-y-auto">
        <div className="mb-4 lg:mb-6">
          <h1 className="text-2xl font-bold text-slate-800 mb-4">Punto de Venta</h1>
          <ProductSearch onAddProduct={addProduct} />
        </div>
        <QuickProducts onAddProduct={addProduct} />
      </div>

      {/* Right: Cart */}
      <div className="w-full lg:w-96 xl:w-[420px] bg-slate-50 border-l border-slate-200 flex flex-col">
        <CartPanel
          cart={cart}
          setCart={setCart}
          onCheckout={() => setShowCheckout(true)}
          globalDiscount={globalDiscount}
          setGlobalDiscount={setGlobalDiscount}
        />
      </div>

      {showCheckout && (
        <CheckoutModal
          cart={cart}
                    subtotal={subtotal + totalDiscount}
          discountAmount={totalDiscount + globalDiscount}
          total={total}
          onClose={() => setShowCheckout(false)}
          onComplete={handleCheckoutComplete}
        />
      )}
    </div>
  );
}
