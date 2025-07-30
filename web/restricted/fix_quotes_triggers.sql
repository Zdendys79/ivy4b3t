-- Fix quotes triggers with correct definer

DROP TRIGGER IF EXISTS quotes_before_insert;
DROP TRIGGER IF EXISTS quotes_before_update;

DELIMITER $$

CREATE TRIGGER quotes_before_insert
BEFORE INSERT ON quotes
FOR EACH ROW
BEGIN
    SET NEW.hash = MD5(NEW.text);
END$$

CREATE TRIGGER quotes_before_update
BEFORE UPDATE ON quotes
FOR EACH ROW
BEGIN
    SET NEW.hash = MD5(NEW.text);
END$$

DELIMITER ;