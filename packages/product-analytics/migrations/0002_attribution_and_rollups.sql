ALTER TABLE product_events ADD COLUMN client_channel TEXT NOT NULL DEFAULT 'web';
ALTER TABLE product_events ADD COLUMN utm_source TEXT;
ALTER TABLE product_events ADD COLUMN utm_medium TEXT;
ALTER TABLE product_events ADD COLUMN utm_campaign TEXT;

CREATE TABLE IF NOT EXISTS product_event_daily (
  day TEXT NOT NULL,
  name TEXT NOT NULL,
  dimension TEXT NOT NULL DEFAULT '',
  device TEXT NOT NULL,
  referrer TEXT NOT NULL,
  client_channel TEXT NOT NULL,
  utm_source TEXT NOT NULL DEFAULT '',
  utm_medium TEXT NOT NULL DEFAULT '',
  utm_campaign TEXT NOT NULL DEFAULT '',
  events INTEGER NOT NULL,
  visitors INTEGER NOT NULL,
  sessions INTEGER NOT NULL,
  PRIMARY KEY (
    day, name, dimension, device, referrer, client_channel,
    utm_source, utm_medium, utm_campaign
  )
);
CREATE INDEX IF NOT EXISTS idx_product_event_daily_day
  ON product_event_daily(day);

