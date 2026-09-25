-- Two auto-posting flows were missing a JournalSourceType of their own: F&I commission
-- (previously would have had to be posted under the generic 'MANUAL' type) and a vehicle
-- entering stock (used-vehicle purchase or trade-in intake), which had no source type at all
-- because nothing posted for it yet.
ALTER TYPE "JournalSourceType" ADD VALUE 'VEHICLE_STOCK_IN';
ALTER TYPE "JournalSourceType" ADD VALUE 'FI_COMMISSION';
