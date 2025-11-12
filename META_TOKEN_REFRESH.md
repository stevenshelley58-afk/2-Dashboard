# Meta Access Token Expired - Action Required

## Issue
The Meta access token provided has expired (expired on Saturday, 08-Nov-25 17:00:00 PST).

## Solution
You need to get a fresh Meta access token. Here are the options:

### Option 1: Get New Long-Lived Token (Recommended)
1. Go to Meta Developers: https://developers.facebook.com/tools/explorer/
2. Select your app
3. Get User Token with permissions:
   - `ads_read`
   - `ads_management`
   - `business_management`
4. Exchange for Long-Lived Token (60 days):
   ```
   GET https://graph.facebook.com/v18.0/oauth/access_token?
     grant_type=fb_exchange_token&
     client_id={app-id}&
     client_secret={app-secret}&
     fb_exchange_token={short-lived-token}
   ```

### Option 2: Use System User Token (Best for Production)
1. Go to Meta Business Settings
2. Create/Use System User
3. Generate Token with permissions:
   - `ads_read`
   - `ads_management`
   - `business_management`
4. This token doesn't expire (until revoked)

### Option 3: Use App Access Token (If Available)
For server-to-server calls, you can use:
```
GET https://graph.facebook.com/v18.0/oauth/access_token?
  client_id={app-id}&
  client_secret={app-secret}&
  grant_type=client_credentials
```

## Once You Have New Token

Update the worker environment variable:
```bash
export META_ACCESS_TOKEN="your-new-token-here"
```

Then restart the worker - it will automatically pick up the queued job and continue.

## Current Status
- ✅ Job is queued (ID: 895deb51-4231-40b4-ae6c-332b1eba4725)
- ✅ Worker code is ready
- ✅ All other credentials are valid
- ❌ Meta token expired - needs refresh

The worker will automatically retry once a valid token is provided.
