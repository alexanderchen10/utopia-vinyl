declare namespace Cloudflare {
  interface Env {
    DB: D1Database;
    AI?: Ai;
    ADMIN_EMAILS?: string;
    ADMIN_PASSWORD_HASH?: string;
    ADMIN_SESSION_SECRET?: string;
    SHOPIFY_API_SECRET?: string;
    SHOPIFY_SHOP_DOMAIN?: string;
    SHOPIFY_LOCATION_ID?: string;
    SHOPIFY_STOREFRONT_ACCESS_TOKEN?: string;
  }
}
