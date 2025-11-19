-- Allow users to insert into app_dashboard.users
create policy "Users can insert their own data"
    on app_dashboard.users for insert
    with check (auth.uid() = id);

-- Allow users to insert into core_warehouse.shops
create policy "Users can insert shops"
    on core_warehouse.shops for insert
    with check (true);

-- Allow users to insert into app_dashboard.user_shops
create policy "Users can insert user_shops"
    on app_dashboard.user_shops for insert
    with check (auth.uid() = user_id);

-- Allow users to insert into core_warehouse.shop_credentials
create policy "Users can insert shop_credentials"
    on core_warehouse.shop_credentials for insert
    with check (
        exists (
            select 1 from app_dashboard.user_shops us
            where us.shop_id = shop_id
            and us.user_id = auth.uid()
        )
    );

-- Allow users to insert into core_warehouse.sync_jobs
create policy "Users can insert sync_jobs"
    on core_warehouse.sync_jobs for insert
    with check (
        exists (
            select 1 from app_dashboard.user_shops us
            where us.shop_id = shop_id
            and us.user_id = auth.uid()
        )
    );

