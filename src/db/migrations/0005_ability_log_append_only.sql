CREATE TRIGGER ability_log_no_update BEFORE UPDATE ON ability_log
BEGIN
  SELECT RAISE(ABORT, 'ability_log is append-only');
END;
--> statement-breakpoint
CREATE TRIGGER ability_log_no_delete BEFORE DELETE ON ability_log
BEGIN
  SELECT RAISE(ABORT, 'ability_log is append-only');
END;
