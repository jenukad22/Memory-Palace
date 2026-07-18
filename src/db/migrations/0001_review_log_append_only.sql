CREATE TRIGGER review_log_no_update BEFORE UPDATE ON review_log
BEGIN
  SELECT RAISE(ABORT, 'review_log is append-only');
END;
--> statement-breakpoint
CREATE TRIGGER review_log_no_delete BEFORE DELETE ON review_log
BEGIN
  SELECT RAISE(ABORT, 'review_log is append-only');
END;
