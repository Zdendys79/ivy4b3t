-- Rename columns in fb_groups table
-- nazev -> name
-- typ -> type

USE ivy;

-- First, rename the columns
ALTER TABLE fb_groups CHANGE COLUMN nazev name TINYTEXT;
ALTER TABLE fb_groups CHANGE COLUMN typ type VARCHAR(2);

-- Add comment for new type 'E'
-- Types: G=Běžné skupiny, GV=Vlastní skupiny, P=Prodejní skupiny, E=Exploration (nové)