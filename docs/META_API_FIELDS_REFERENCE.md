# Meta Marketing API - Complete Fields Reference

## Entity Fields Extracted

### Ad Account
```
id, account_id, name, currency, timezone_name
business_name, business, account_status, disable_reason
amount_spent, balance, created_time
min_campaign_group_spend_cap, min_daily_budget
```

### Campaign
```
id, name, status, objective, buying_type, bid_strategy
budget_remaining, daily_budget, lifetime_budget, spend_cap
special_ad_categories, start_time, stop_time
created_time, updated_time, account_id
```

**Status Values:** `ACTIVE`, `PAUSED`, `DELETED`, `ARCHIVED`

**Objectives (v21.0):**
- `OUTCOME_SALES` - Drive sales/conversions
- `OUTCOME_LEADS` - Generate leads
- `OUTCOME_AWARENESS` - Brand awareness
- `OUTCOME_ENGAGEMENT` - Post engagement
- `OUTCOME_TRAFFIC` - Website/app traffic
- `OUTCOME_APP_PROMOTION` - App installs

### AdSet
```
id, name, status, campaign_id, account_id
optimization_goal, billing_event, bid_amount, bid_strategy
daily_budget, lifetime_budget, budget_remaining
start_time, end_time, created_time, updated_time
targeting, destination_type, promoted_object, attribution_spec
```

**Optimization Goals:**
- `OFFSITE_CONVERSIONS` - Website conversions
- `LINK_CLICKS` - Link clicks
- `IMPRESSIONS` - Impressions
- `REACH` - Unique reach
- `LANDING_PAGE_VIEWS` - Landing page views
- `VALUE` - Conversion value
- `THRUPLAY` - Video views (15s+)

**Targeting Fields (JSONB):**
```json
{
  "age_min": 18,
  "age_max": 65,
  "genders": [1, 2],
  "geo_locations": {
    "countries": ["US", "CA"],
    "regions": [...],
    "cities": [...],
    "zips": [...]
  },
  "interests": [...],
  "behaviors": [...],
  "custom_audiences": [...],
  "excluded_custom_audiences": [...],
  "flexible_spec": [...]
}
```

### Ad
```
id, name, status, adset_id, campaign_id, account_id
creative{id}, tracking_specs, conversion_specs
created_time, updated_time
```

### Creative
```
id, name, title, body, link_url, call_to_action_type
image_hash, image_url, video_id, thumbnail_url
object_type, object_story_spec, asset_feed_spec
product_set_id, effective_object_story_id
instagram_actor_id, instagram_permalink_url, status
```

**Call-to-Action Types:**
- `SHOP_NOW`
- `LEARN_MORE`
- `SIGN_UP`
- `DOWNLOAD`
- `BOOK_TRAVEL`
- `GET_OFFER`
- `CONTACT_US`
- `APPLY_NOW`
- `SUBSCRIBE`
- `WATCH_MORE`

**Object Types:**
- `SHARE` - Link share
- `PHOTO` - Single image
- `VIDEO` - Single video
- `CAROUSEL` - Multi-image/video carousel
- `COLLECTION` - Product collection

### Image
```
id, hash, url, permalink_url, width, height
```

### Video
```
id, title, description, source, permalink_url
length, picture, format, updated_time, created_time
```

---

## Insights Fields Extracted

### Core Performance Metrics
```
date_start, date_stop
spend, impressions, clicks, reach, frequency
```

### Cost Metrics
```
cpm       - Cost per 1,000 impressions
cpc       - Cost per click
ctr       - Click-through rate (%)
cpp       - Cost per 1,000 people reached
```

### Conversion Actions (from `actions` array)

**Purchase Funnel:**
```
offsite_conversion.fb_pixel_view_content
offsite_conversion.fb_pixel_add_to_cart
offsite_conversion.fb_pixel_initiate_checkout
offsite_conversion.fb_pixel_purchase
```

**Lead Actions:**
```
offsite_conversion.fb_pixel_lead
offsite_conversion.fb_pixel_complete_registration
offsite_conversion.fb_pixel_submit_application
```

**Engagement Actions:**
```
post_engagement          - Total post engagement
post_reaction            - Reactions (like, love, etc.)
comment                  - Comments
post                     - Shares
onsite_conversion.post_save  - Post saves
```

**Video Actions:**
```
video_view                        - 3+ second views
video_p25_watched_actions         - 25% complete
video_p50_watched_actions         - 50% complete
video_p75_watched_actions         - 75% complete
video_p100_watched_actions        - 100% complete
video_avg_time_watched_actions    - Avg watch time
```

**Link Click Actions:**
```
link_click                - Link clicks
outbound_click            - Outbound clicks
landing_page_view         - Landing page views
```

### Conversion Values (from `action_values` array)

```
offsite_conversion.fb_pixel_purchase   - Purchase revenue value
purchase_roas                          - Return on ad spend
```

### Advanced Metrics

**Unique Metrics:**
```
unique_clicks              - Unique people who clicked
unique_ctr                 - Unique CTR
unique_link_clicks_ctr     - Unique link click CTR
```

**Cost Per Action:**
```
cost_per_action_type             - Array of costs per action
cost_per_unique_action_type      - Array of costs per unique action
```

---

## Breakdown Dimensions

### Age & Gender Breakdown
```
breakdowns: ["age", "gender"]
```

**Age Buckets:**
- `18-24`
- `25-34`
- `35-44`
- `45-54`
- `55-64`
- `65+`

**Gender Values:**
- `male`
- `female`
- `unknown`

### Device/Platform Breakdown
```
breakdowns: ["device_platform", "publisher_platform", "platform_position"]
```

**Device Platforms:**
- `mobile`
- `desktop`
- `unknown`

**Publisher Platforms:**
- `facebook`
- `instagram`
- `messenger`
- `audience_network`

**Platform Positions:**
- `feed` - News Feed
- `right_hand_column` - Right column (desktop)
- `instant_article` - Instant Articles
- `story` - Stories
- `reels` - Reels
- `search` - Search results
- `video_feeds` - Video feeds
- `marketplace` - Marketplace

**Impression Devices (more granular):**
- `iPhone`
- `iPad`
- `Android_Smartphone`
- `Android_Tablet`
- `Desktop`
- etc.

### Geographic Breakdown
```
breakdowns: ["country", "region", "dma"]
```

**Country:** ISO 2-letter codes (e.g., `US`, `CA`, `GB`)

**Region:** State/province codes (e.g., `California`, `New York`)

**DMA:** Designated Market Area (US only, e.g., `New York NY`, `Los Angeles CA`)

---

## Attribution Windows

Meta supports multiple attribution windows for conversion tracking:

```
1d_click    - 1-day click attribution
7d_click    - 7-day click attribution (default)
1d_view     - 1-day view attribution
7d_view     - 7-day view attribution
```

**Note:** View-through attribution windows are being deprecated. Design your schema to support flexible attribution windows.

---

## API Response Structure

### Paginated Response
```json
{
  "data": [
    { /* entity object */ },
    { /* entity object */ }
  ],
  "paging": {
    "cursors": {
      "before": "cursor_string",
      "after": "cursor_string"
    },
    "next": "https://graph.facebook.com/v21.0/..."
  }
}
```

### Actions Array Structure
```json
{
  "actions": [
    {
      "action_type": "offsite_conversion.fb_pixel_purchase",
      "value": "42"
    },
    {
      "action_type": "link_click",
      "value": "1234"
    }
  ],
  "action_values": [
    {
      "action_type": "offsite_conversion.fb_pixel_purchase",
      "value": "3542.50"
    }
  ]
}
```

### Targeting Structure
```json
{
  "targeting": {
    "age_min": 25,
    "age_max": 54,
    "genders": [1],
    "geo_locations": {
      "countries": ["US"],
      "location_types": ["home", "recent"]
    },
    "interests": [
      {
        "id": "6003139266461",
        "name": "Online shopping"
      }
    ],
    "custom_audiences": [
      {
        "id": "123456789",
        "name": "Website Visitors - 30 Days"
      }
    ]
  }
}
```

---

## Rate Limits & Best Practices

### Rate Limits
- **200 calls per hour** per ad account
- **4800 calls per hour** per app
- Recommended: **25 insights calls per hour** to avoid throttling

### Batch Requests
Use batch requests to reduce API calls:
```
https://graph.facebook.com/v21.0/
  ?batch=[
    {"method":"GET","relative_url":"campaign_id/insights"},
    {"method":"GET","relative_url":"campaign_id_2/insights"}
  ]
```

### Async Insights
For large date ranges, use async insights:
```
POST /act_{ad_account_id}/insights
  ?time_range={"since":"2024-01-01","until":"2024-12-31"}
  &async=true

→ Returns report_run_id

GET /{report_run_id}
  → Poll until status = "Job Completed"

GET /{report_run_id}/insights
  → Fetch results
```

### Caching
- Insights data has ~1 day lag
- Cache entity metadata for 1 hour
- Cache insights for 24 hours
- Re-sync last 7 days daily to catch delayed conversions

---

## Version Compatibility

Current implementation uses **v21.0** (latest as of Jan 2025).

**Breaking Changes in Recent Versions:**
- v18.0: Removed view-through attribution for conversions API
- v19.0: Deprecated `effective_status` in favor of `status`
- v20.0: Changed `objective` values to `OUTCOME_*` format
- v21.0: Added `purchase_roas` field to insights

**Recommended:** Update `META_API_VERSION` annually to stay current.

---

## Testing Your Setup

### 1. Verify API Access
```bash
curl "https://graph.facebook.com/v21.0/act_${ACCOUNT_ID}?access_token=${TOKEN}&fields=name,account_status"
```

### 2. Test Insights Query
```bash
curl "https://graph.facebook.com/v21.0/act_${ACCOUNT_ID}/insights?access_token=${TOKEN}&fields=spend,impressions&time_range={\"since\":\"2024-01-01\",\"until\":\"2024-01-31\"}"
```

### 3. Check Permissions
Required permissions:
- `ads_read`
- `ads_management` (optional, for write operations)

### 4. Verify Pixel Events
Ensure your pixel is firing these events:
- `PageView`
- `ViewContent`
- `AddToCart`
- `InitiateCheckout`
- `Purchase`

---

## Useful Resources

- **API Explorer**: https://developers.facebook.com/tools/explorer/
- **Marketing API Docs**: https://developers.facebook.com/docs/marketing-api
- **Insights API**: https://developers.facebook.com/docs/marketing-api/insights
- **Targeting Specs**: https://developers.facebook.com/docs/marketing-api/targeting-specs
- **API Changelog**: https://developers.facebook.com/docs/graph-api/changelog
