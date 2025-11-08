-- Enable Row Level Security (RLS) for frontend access
-- This allows the Vercel frontend to read data using the anon key

-- Enable RLS on orders table
ALTER TABLE core_warehouse.orders ENABLE ROW LEVEL SECURITY;

-- Allow anon users to read orders
CREATE POLICY "Allow anon read orders"
ON core_warehouse.orders
FOR SELECT
TO anon
USING (true);

-- Enable RLS on etl_runs table
ALTER TABLE core_warehouse.etl_runs ENABLE ROW LEVEL SECURITY;

-- Allow anon users to read etl_runs
CREATE POLICY "Allow anon read etl_runs"
ON core_warehouse.etl_runs
FOR SELECT
TO anon
USING (true);

-- Allow anon users to insert etl_runs (for triggering syncs)
CREATE POLICY "Allow anon insert etl_runs"
ON core_warehouse.etl_runs
FOR INSERT
TO anon
WITH CHECK (true);
