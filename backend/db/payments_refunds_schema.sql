CREATE TABLE IF NOT EXISTS payments (
    id SERIAL PRIMARY KEY,
    mongo_order_id TEXT NOT NULL,
    razorpay_payment_id TEXT NOT NULL UNIQUE,
    razorpay_order_id TEXT,
    amount NUMERIC(10, 2) NOT NULL CHECK (amount > 0),
    currency TEXT NOT NULL DEFAULT 'INR',
    status TEXT NOT NULL DEFAULT 'captured',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payments_mongo_order_id ON payments(mongo_order_id);

CREATE TABLE IF NOT EXISTS refunds (
    id SERIAL PRIMARY KEY,
    payment_id INTEGER NOT NULL REFERENCES payments(id),
    mongo_order_id TEXT NOT NULL,
    mongo_shop_id TEXT NOT NULL,
    razorpay_refund_id TEXT,
    amount NUMERIC(10, 2) NOT NULL CHECK (amount > 0),
    reason TEXT,
    status TEXT NOT NULL DEFAULT 'processed',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_refunds_payment_id ON refunds(payment_id);