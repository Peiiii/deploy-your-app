export interface PointsItem {
  id: string;
  project_id: string;
  author_id: string;
  name: string;
  description: string;
  type: 'repeatable' | 'durable' | 'term';
  price: number;
  entitlement: string;
  units: number;
  period_seconds: number;
  delivery: 'grant' | 'ai';
  enabled: number;
  created_at: number;
}
export interface PointsIntent {
  id: string;
  user_id: string;
  project_id: string;
  item_id: string;
  request_id: string;
  origin: string;
  state: string;
  expires_at: number;
}
export interface PointsReceipt {
  id: string;
  user_id: string;
  project_id: string;
  author_id: string;
  item_id: string;
  request_id: string;
  status: 'prepared' | 'reserved' | 'running' | 'granted' | 'released' | 'unknown' | 'refunded';
  price: number;
  paid_minor: number;
  creator_minor: number;
  currency: string;
  result: string | null;
  previous_expiry: number | null;
  previous_receipt: string | null;
  created_at: number;
  updated_at: number;
  error: string | null;
}
export interface PointsLot {
  id: string;
  remaining: number;
  total: number;
  paid_minor: number;
  fee_minor: number;
  currency: string;
}
export const receiptView = (r: PointsReceipt) => ({
  id: r.id,
  itemId: r.item_id,
  requestId: r.request_id,
  status: r.status,
  points: r.price,
  result: r.result ? JSON.parse(r.result) : null,
  error: r.error,
  createdAt: r.created_at,
});
