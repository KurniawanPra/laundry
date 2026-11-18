-- DropIndex
DROP INDEX `Customer_phone_key` ON `customer`;

-- DropIndex
DROP INDEX `LaundrySpeed_name_key` ON `laundryspeed`;

-- DropIndex
DROP INDEX `Order_invoiceCode_key` ON `order`;

-- DropIndex
DROP INDEX `Store_code_key` ON `store`;

-- AlterTable
ALTER TABLE `appsetting` DROP PRIMARY KEY,
    ADD COLUMN `id` INTEGER NOT NULL AUTO_INCREMENT,
    ADD COLUMN `tenantId` INTEGER NULL,
    ADD PRIMARY KEY (`id`);

-- AlterTable
ALTER TABLE `cashclosure` ADD COLUMN `tenantId` INTEGER NULL;

-- AlterTable
ALTER TABLE `complaint` ADD COLUMN `tenantId` INTEGER NULL;

-- AlterTable
ALTER TABLE `customer` ADD COLUMN `tenantId` INTEGER NULL;

-- AlterTable
ALTER TABLE `laundryspeed` ADD COLUMN `tenantId` INTEGER NULL;

-- AlterTable
ALTER TABLE `order` ADD COLUMN `tenantId` INTEGER NULL;

-- AlterTable
ALTER TABLE `orderitem` ADD COLUMN `tenantId` INTEGER NULL;

-- AlterTable
ALTER TABLE `orderstatuslog` ADD COLUMN `tenantId` INTEGER NULL;

-- AlterTable
ALTER TABLE `payment` ADD COLUMN `tenantId` INTEGER NULL;

-- AlterTable
ALTER TABLE `service` ADD COLUMN `tenantId` INTEGER NULL;

-- AlterTable
ALTER TABLE `store` ADD COLUMN `tenantId` INTEGER NULL;

-- AlterTable
ALTER TABLE `user` ADD COLUMN `tenantId` INTEGER NULL;

-- CreateTable
CREATE TABLE `Tenant` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `status` ENUM('TRIAL', 'ACTIVE', 'SUSPENDED', 'EXPIRED') NOT NULL DEFAULT 'TRIAL',
    `trialEndsAt` DATETIME(3) NULL,
    `planId` INTEGER NULL,
    `settings` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Tenant_slug_key`(`slug`),
    INDEX `Tenant_status_idx`(`status`),
    INDEX `Tenant_planId_idx`(`planId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SubscriptionPlan` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `price` INTEGER NOT NULL DEFAULT 0,
    `billingCycle` ENUM('MONTHLY', 'YEARLY') NOT NULL DEFAULT 'MONTHLY',
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `SubscriptionPlan_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FeatureDefinition` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `type` ENUM('TOGGLE', 'QUOTA') NOT NULL,
    `defaultValue` VARCHAR(191) NOT NULL DEFAULT 'false',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `FeatureDefinition_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PlanFeature` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `planId` INTEGER NOT NULL,
    `featureCode` VARCHAR(191) NOT NULL,
    `value` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `PlanFeature_planId_idx`(`planId`),
    UNIQUE INDEX `PlanFeature_planId_featureCode_key`(`planId`, `featureCode`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TenantFeatureOverride` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tenantId` INTEGER NOT NULL,
    `featureCode` VARCHAR(191) NOT NULL,
    `value` VARCHAR(191) NOT NULL,
    `reason` TEXT NOT NULL,
    `expiresAt` DATETIME(3) NULL,
    `createdById` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `TenantFeatureOverride_tenantId_idx`(`tenantId`),
    UNIQUE INDEX `TenantFeatureOverride_tenantId_featureCode_key`(`tenantId`, `featureCode`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Idempotent Data Backfill:
-- 1. Create Default Plan if not exists
INSERT INTO `SubscriptionPlan` (`id`, `code`, `name`, `price`, `billingCycle`, `isActive`, `createdAt`, `updatedAt`)
SELECT 1, 'PRO_MONTHLY', 'Paket Pro (Default)', 150000, 'MONTHLY', true, NOW(3), NOW(3)
WHERE NOT EXISTS (SELECT 1 FROM `SubscriptionPlan` WHERE `id` = 1 OR `code` = 'PRO_MONTHLY');

-- 2. Create Default Tenant if not exists
INSERT INTO `Tenant` (`id`, `name`, `slug`, `status`, `planId`, `createdAt`, `updatedAt`)
SELECT 1, 'Laundry Utama', 'laundry-utama', 'ACTIVE', 1, NOW(3), NOW(3)
WHERE NOT EXISTS (SELECT 1 FROM `Tenant` WHERE `id` = 1 OR `slug` = 'laundry-utama');

-- 3. Populate default features
INSERT INTO `FeatureDefinition` (`code`, `name`, `type`, `defaultValue`, `createdAt`)
SELECT 'outlet.multi', 'Multi Cabang / Outlet', 'TOGGLE', 'true', NOW(3)
WHERE NOT EXISTS (SELECT 1 FROM `FeatureDefinition` WHERE `code` = 'outlet.multi');

INSERT INTO `FeatureDefinition` (`code`, `name`, `type`, `defaultValue`, `createdAt`)
SELECT 'report.profit_loss', 'Laporan Laba Rugi', 'TOGGLE', 'true', NOW(3)
WHERE NOT EXISTS (SELECT 1 FROM `FeatureDefinition` WHERE `code` = 'report.profit_loss');

INSERT INTO `FeatureDefinition` (`code`, `name`, `type`, `defaultValue`, `createdAt`)
SELECT 'export.excel', 'Export Excel / CSV', 'TOGGLE', 'true', NOW(3)
WHERE NOT EXISTS (SELECT 1 FROM `FeatureDefinition` WHERE `code` = 'export.excel');

INSERT INTO `FeatureDefinition` (`code`, `name`, `type`, `defaultValue`, `createdAt`)
SELECT 'notify.whatsapp', 'Notifikasi WhatsApp Pelanggan', 'TOGGLE', 'true', NOW(3)
WHERE NOT EXISTS (SELECT 1 FROM `FeatureDefinition` WHERE `code` = 'notify.whatsapp');

INSERT INTO `FeatureDefinition` (`code`, `name`, `type`, `defaultValue`, `createdAt`)
SELECT 'staff.limit', 'Batas Jumlah Petugas', 'QUOTA', '10', NOW(3)
WHERE NOT EXISTS (SELECT 1 FROM `FeatureDefinition` WHERE `code` = 'staff.limit');

INSERT INTO `FeatureDefinition` (`code`, `name`, `type`, `defaultValue`, `createdAt`)
SELECT 'order.monthly_limit', 'Batas Order Per Bulan', 'QUOTA', '-1', NOW(3)
WHERE NOT EXISTS (SELECT 1 FROM `FeatureDefinition` WHERE `code` = 'order.monthly_limit');

-- Associate Plan Features for Plan 1
INSERT INTO `PlanFeature` (`planId`, `featureCode`, `value`, `createdAt`, `updatedAt`)
SELECT 1, 'outlet.multi', 'true', NOW(3), NOW(3)
WHERE NOT EXISTS (SELECT 1 FROM `PlanFeature` WHERE `planId` = 1 AND `featureCode` = 'outlet.multi');

INSERT INTO `PlanFeature` (`planId`, `featureCode`, `value`, `createdAt`, `updatedAt`)
SELECT 1, 'report.profit_loss', 'true', NOW(3), NOW(3)
WHERE NOT EXISTS (SELECT 1 FROM `PlanFeature` WHERE `planId` = 1 AND `featureCode` = 'report.profit_loss');

INSERT INTO `PlanFeature` (`planId`, `featureCode`, `value`, `createdAt`, `updatedAt`)
SELECT 1, 'export.excel', 'true', NOW(3), NOW(3)
WHERE NOT EXISTS (SELECT 1 FROM `PlanFeature` WHERE `planId` = 1 AND `featureCode` = 'export.excel');

INSERT INTO `PlanFeature` (`planId`, `featureCode`, `value`, `createdAt`, `updatedAt`)
SELECT 1, 'notify.whatsapp', 'true', NOW(3), NOW(3)
WHERE NOT EXISTS (SELECT 1 FROM `PlanFeature` WHERE `planId` = 1 AND `featureCode` = 'notify.whatsapp');

INSERT INTO `PlanFeature` (`planId`, `featureCode`, `value`, `createdAt`, `updatedAt`)
SELECT 1, 'staff.limit', '10', NOW(3), NOW(3)
WHERE NOT EXISTS (SELECT 1 FROM `PlanFeature` WHERE `planId` = 1 AND `featureCode` = 'staff.limit');

INSERT INTO `PlanFeature` (`planId`, `featureCode`, `value`, `createdAt`, `updatedAt`)
SELECT 1, 'order.monthly_limit', '-1', NOW(3), NOW(3)
WHERE NOT EXISTS (SELECT 1 FROM `PlanFeature` WHERE `planId` = 1 AND `featureCode` = 'order.monthly_limit');

-- 4. Backfill all existing business records to Default Tenant (id = 1)
UPDATE `store` SET `tenantId` = 1 WHERE `tenantId` IS NULL;
UPDATE `customer` SET `tenantId` = 1 WHERE `tenantId` IS NULL;
UPDATE `service` SET `tenantId` = 1 WHERE `tenantId` IS NULL;
UPDATE `laundryspeed` SET `tenantId` = 1 WHERE `tenantId` IS NULL;
UPDATE `order` SET `tenantId` = 1 WHERE `tenantId` IS NULL;
UPDATE `orderitem` SET `tenantId` = 1 WHERE `tenantId` IS NULL;
UPDATE `payment` SET `tenantId` = 1 WHERE `tenantId` IS NULL;
UPDATE `orderstatuslog` SET `tenantId` = 1 WHERE `tenantId` IS NULL;
UPDATE `complaint` SET `tenantId` = 1 WHERE `tenantId` IS NULL;
UPDATE `cashclosure` SET `tenantId` = 1 WHERE `tenantId` IS NULL;
UPDATE `appsetting` SET `tenantId` = 1 WHERE `tenantId` IS NULL;

-- 5. Backfill users: Owner & Staff get tenantId = 1; SUPER_OWNER stays NULL
UPDATE `user` SET `tenantId` = 1 WHERE `tenantId` IS NULL AND `role` != 'SUPER_OWNER';

-- CreateIndex
CREATE INDEX `AppSetting_tenantId_idx` ON `AppSetting`(`tenantId`);

-- CreateIndex
CREATE UNIQUE INDEX `AppSetting_tenantId_key_key` ON `AppSetting`(`tenantId`, `key`);

-- CreateIndex
CREATE INDEX `CashClosure_tenantId_idx` ON `CashClosure`(`tenantId`);

-- CreateIndex
CREATE INDEX `Complaint_tenantId_idx` ON `Complaint`(`tenantId`);

-- CreateIndex
CREATE INDEX `Customer_tenantId_idx` ON `Customer`(`tenantId`);

-- CreateIndex
CREATE UNIQUE INDEX `Customer_tenantId_phone_key` ON `Customer`(`tenantId`, `phone`);

-- CreateIndex
CREATE INDEX `LaundrySpeed_tenantId_idx` ON `LaundrySpeed`(`tenantId`);

-- CreateIndex
CREATE UNIQUE INDEX `LaundrySpeed_tenantId_name_key` ON `LaundrySpeed`(`tenantId`, `name`);

-- CreateIndex
CREATE INDEX `Order_tenantId_idx` ON `Order`(`tenantId`);

-- CreateIndex
CREATE UNIQUE INDEX `Order_tenantId_invoiceCode_key` ON `Order`(`tenantId`, `invoiceCode`);

-- CreateIndex
CREATE INDEX `OrderItem_tenantId_idx` ON `OrderItem`(`tenantId`);

-- CreateIndex
CREATE INDEX `OrderStatusLog_tenantId_idx` ON `OrderStatusLog`(`tenantId`);

-- CreateIndex
CREATE INDEX `Payment_tenantId_idx` ON `Payment`(`tenantId`);

-- CreateIndex
CREATE INDEX `Service_tenantId_idx` ON `Service`(`tenantId`);

-- CreateIndex
CREATE INDEX `Store_tenantId_idx` ON `Store`(`tenantId`);

-- CreateIndex
CREATE UNIQUE INDEX `Store_tenantId_code_key` ON `Store`(`tenantId`, `code`);

-- CreateIndex
CREATE INDEX `User_tenantId_idx` ON `User`(`tenantId`);

-- AddForeignKey
ALTER TABLE `Tenant` ADD CONSTRAINT `Tenant_planId_fkey` FOREIGN KEY (`planId`) REFERENCES `SubscriptionPlan`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PlanFeature` ADD CONSTRAINT `PlanFeature_planId_fkey` FOREIGN KEY (`planId`) REFERENCES `SubscriptionPlan`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TenantFeatureOverride` ADD CONSTRAINT `TenantFeatureOverride_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Store` ADD CONSTRAINT `Store_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Customer` ADD CONSTRAINT `Customer_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Service` ADD CONSTRAINT `Service_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LaundrySpeed` ADD CONSTRAINT `LaundrySpeed_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Order` ADD CONSTRAINT `Order_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OrderItem` ADD CONSTRAINT `OrderItem_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Payment` ADD CONSTRAINT `Payment_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OrderStatusLog` ADD CONSTRAINT `OrderStatusLog_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Complaint` ADD CONSTRAINT `Complaint_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `User` ADD CONSTRAINT `User_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CashClosure` ADD CONSTRAINT `CashClosure_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AppSetting` ADD CONSTRAINT `AppSetting_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
