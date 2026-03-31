CREATE TABLE "admin_audit_logs" (
  "id" TEXT NOT NULL,
  "admin_user_id" TEXT,
  "username" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "ip_address" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "admin_audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "admin_audit_logs_created_at_idx" ON "admin_audit_logs"("created_at");
CREATE INDEX "admin_audit_logs_action_idx" ON "admin_audit_logs"("action");

ALTER TABLE "admin_audit_logs"
ADD CONSTRAINT "admin_audit_logs_admin_user_id_fkey"
FOREIGN KEY ("admin_user_id") REFERENCES "admin_users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
