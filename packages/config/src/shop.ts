const SHOPIFY_DOMAIN_SUFFIX = '.myshopify.com';

const DOMAIN_SANITIZE_REGEX = /^https?:\/\//i;

/**
 * Normalize any Shopify shop domain string (with or without protocol) to its canonical shop_id.
 * Canonical shop_id is always the Shopify subdomain (lowercase, no dots).
 */
export function normalizeShopifyDomainToShopId(input: string): string {
  const raw = (input ?? '').trim();

  if (!raw) {
    throw new Error('Shop domain is required');
  }

  const lowered = raw.toLowerCase().replace(DOMAIN_SANITIZE_REGEX, '');
  const domain = lowered.split(/[/?#]/)[0];

  if (!domain) {
    throw new Error('Shop domain is invalid');
  }

  const withoutSuffix = domain.endsWith(SHOPIFY_DOMAIN_SUFFIX)
    ? domain.slice(0, -SHOPIFY_DOMAIN_SUFFIX.length)
    : domain;

  if (!withoutSuffix) {
    throw new Error('Shop domain is invalid');
  }

  if (withoutSuffix.includes('.')) {
    throw new Error('shop_id must be the Shopify subdomain (no dots)');
  }

  return withoutSuffix;
}

/**
 * Convert a canonical shop identifier (or domain) into the full Shopify domain.
 * The return value is always lowercase and guaranteed to end with .myshopify.com.
 */
export function normalizeShopIdToShopifyDomain(input: string): string {
  const shopId = normalizeShopifyDomainToShopId(input);
  return `${shopId}${SHOPIFY_DOMAIN_SUFFIX}`;
}

export { SHOPIFY_DOMAIN_SUFFIX };

