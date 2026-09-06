declare namespace Cloudflare {
  interface Env {
    DB: D1Database;
    ADMIN_EMAILS?: string;
    ADMIN_PASSWORD_HASH?: string;
    ADMIN_SESSION_SECRET?: string;
  }
}
