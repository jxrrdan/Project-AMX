-- AlterTable
ALTER TABLE "online_booking_requests" ADD COLUMN     "serviceBookingId" TEXT;

-- AlterTable
ALTER TABLE "service_plan_subscriptions" ADD COLUMN     "accountCustomerId" TEXT,
ADD COLUMN     "lastBilledAt" TIMESTAMP(3);

-- AddForeignKey
ALTER TABLE "service_plan_subscriptions" ADD CONSTRAINT "service_plan_subscriptions_accountCustomerId_fkey" FOREIGN KEY ("accountCustomerId") REFERENCES "account_customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
