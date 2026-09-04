declare namespace Cloudflare {
  interface Env {
    DB: D1Database;
    RECORD_COVERS: R2Bucket;
    ACCESS_TEAM_DOMAIN?: string;
    ACCESS_AUD?: string;
    ADMIN_EMAILS?: string;
  }
}
