export interface PointsItem {
  id: string;
  name: string;
  description: string;
  type: 'repeatable' | 'durable' | 'term';
  price: number;
  entitlement: string;
  units: number;
  period_seconds: number;
  delivery: 'grant' | 'ai';
}
export interface PointsReceipt {
  id: string;
  itemId: string;
  requestId: string;
  points: number;
  createdAt: number;
  status: 'prepared' | 'reserved' | 'running' | 'granted' | 'released' | 'unknown' | 'refunded';
  result: { text: string } | null;
  error: string | null;
}
export interface PointsGrants {
  durable: { entitlement: string; receipt_id: string }[];
  terms: { entitlement: string; receipt_id: string; expires_at: number }[];
  quotas: { entitlement: string; receipt_id: string; remaining: number; total: number }[];
}
export type PointsPurchaseResult =
  | PointsReceipt
  | { status: 'cancelled' | 'pending'; requestId: string; confirmationUrl?: string };
export interface PointsAPI {
  items(): Promise<PointsItem[]>;
  purchase(input: {
    itemId: string;
    requestId: string;
    topic?: string;
  }): Promise<PointsPurchaseResult>;
  receipt(input: { requestId: string } | { id: string }): Promise<PointsReceipt | null>;
  grants(): Promise<PointsGrants>;
  consume(input: { grantId: string; requestId: string }): Promise<{ consumed: true }>;
}
