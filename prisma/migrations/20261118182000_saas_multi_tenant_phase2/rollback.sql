-- Rollback Script for 20261118182000_saas_multi_tenant_phase2

-- Drop Foreign Keys
ALTER TABLE `Tenant` DROP FOREIGN KEY `Tenant_planId_fkey`;
ALTER TABLE `PlanFeature` DROP FOREIGN KEY `PlanFeature_planId_fkey`;
ALTER TABLE `TenantFeatureOverride` DROP FOREIGN KEY `TenantFeatureOverride_tenantId_fkey`;
ALTER TABLE `Store` DROP FOREIGN KEY `Store_tenantId_fkey`;
ALTER TABLE `Customer` DROP FOREIGN KEY `Customer_tenantId_fkey`;
ALTER TABLE `Service` DROP FOREIGN KEY `Service_tenantId_fkey`;
ALTER TABLE `LaundrySpeed` DROP FOREIGN KEY `LaundrySpeed_tenantId_fkey`;
ALTER TABLE `Order` DROP FOREIGN KEY `Order_tenantId_fkey`;
ALTER TABLE `OrderItem` DROP FOREIGN KEY `OrderItem_tenantId_fkey`;
ALTER TABLE `Payment` DROP FOREIGN KEY `Payment_tenantId_fkey`;
ALTER TABLE `OrderStatusLog` DROP FOREIGN KEY `OrderStatusLog_tenantId_fkey`;
ALTER TABLE `Complaint` DROP FOREIGN KEY `Complaint_tenantId_fkey`;
ALTER TABLE `User` DROP FOREIGN KEY `User_tenantId_fkey`;
ALTER TABLE `CashClosure` DROP FOREIGN KEY `CashClosure_tenantId_fkey`;
ALTER TABLE `AppSetting` DROP FOREIGN KEY `AppSetting_tenantId_fkey`;

-- Drop Composite Unique Indexes and Restore Old Indexes
ALTER TABLE `Store` DROP INDEX `Store_tenantId_code_key`, ADD UNIQUE INDEX `Store_code_key`(`code`);
ALTER TABLE `Customer` DROP INDEX `Customer_tenantId_phone_key`, ADD UNIQUE INDEX `Customer_phone_key`(`phone`);
ALTER TABLE `LaundrySpeed` DROP INDEX `LaundrySpeed_tenantId_name_key`, ADD UNIQUE INDEX `LaundrySpeed_name_key`(`name`);
ALTER TABLE `Order` DROP INDEX `Order_tenantId_invoiceCode_key`, ADD UNIQUE INDEX `Order_invoiceCode_key`(`invoiceCode`);
ALTER TABLE `AppSetting` DROP INDEX `AppSetting_tenantId_key_key`, DROP PRIMARY KEY, DROP COLUMN `id`, DROP COLUMN `tenantId`, ADD PRIMARY KEY (`key`);

-- Drop tenantId Columns
ALTER TABLE `CashClosure` DROP COLUMN `tenantId`;
ALTER TABLE `Complaint` DROP COLUMN `tenantId`;
ALTER TABLE `Customer` DROP COLUMN `tenantId`;
ALTER TABLE `LaundrySpeed` DROP COLUMN `tenantId`;
ALTER TABLE `Order` DROP COLUMN `tenantId`;
ALTER TABLE `OrderItem` DROP COLUMN `tenantId`;
ALTER TABLE `OrderStatusLog` DROP COLUMN `tenantId`;
ALTER TABLE `Payment` DROP COLUMN `tenantId`;
ALTER TABLE `Service` DROP COLUMN `tenantId`;
ALTER TABLE `Store` DROP COLUMN `tenantId`;
ALTER TABLE `User` DROP COLUMN `tenantId`;

-- Drop SaaS Tables
DROP TABLE IF EXISTS `TenantFeatureOverride`;
DROP TABLE IF EXISTS `PlanFeature`;
DROP TABLE IF EXISTS `FeatureDefinition`;
DROP TABLE IF EXISTS `Tenant`;
DROP TABLE IF EXISTS `SubscriptionPlan`;
