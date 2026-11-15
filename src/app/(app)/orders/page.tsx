import { Suspense } from 'react';
import OrdersClient from '@/components/OrdersClient';

export default function OrdersPage() {
  return (
    <Suspense fallback={<div className="space-y-3" aria-label="Memuat pesanan">{[0, 1, 2].map((row) => <div key={row} className="h-16 animate-pulse bg-neutral-200" />)}</div>}>
      <OrdersClient />
    </Suspense>
  );
}
