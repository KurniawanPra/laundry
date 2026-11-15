-- Preserve legacy order statuses while adding the expanded workflow.
ALTER TABLE `Order`
  MODIFY `status` ENUM(
    'PENDING',
    'WASHING',
    'DRYING',
    'IRONING',
    'READY',
    'COMPLETED',
    'RECEIVED',
    'QUEUED',
    'PACKAGED',
    'CANCELLED'
  ) NOT NULL DEFAULT 'RECEIVED';

UPDATE `Order` SET `status` = 'QUEUED' WHERE `status` = 'PENDING';

ALTER TABLE `Order`
  MODIFY `status` ENUM(
    'RECEIVED',
    'QUEUED',
    'WASHING',
    'DRYING',
    'IRONING',
    'PACKAGED',
    'READY',
    'COMPLETED',
    'CANCELLED'
  ) NOT NULL DEFAULT 'RECEIVED',
  MODIFY `paymentStatus` ENUM('UNPAID', 'PARTIAL', 'PAID') NOT NULL DEFAULT 'UNPAID',
  ADD COLUMN `rackLocation` VARCHAR(32) NULL,
  ADD COLUMN `pickedUpBy` VARCHAR(191) NULL,
  ADD COLUMN `cancellationReason` TEXT NULL,
  ADD COLUMN `createdById` INTEGER NULL,
  ADD INDEX `Order_status_estimatedDone_idx`(`status`, `estimatedDone`),
  ADD INDEX `Order_createdAt_idx`(`createdAt`);

ALTER TABLE `Service`
  ADD COLUMN `unitCode` ENUM('PER_KG', 'PER_PCS', 'PER_M2') NOT NULL DEFAULT 'PER_KG',
  ADD COLUMN `regularPrice` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `expressPrice` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `expressDurationHrs` INTEGER NOT NULL DEFAULT 24;

UPDATE `Service`
SET
  `unitCode` = CASE LOWER(`unit`)
    WHEN 'pcs' THEN 'PER_PCS'
    WHEN 'm2' THEN 'PER_M2'
    WHEN 'm²' THEN 'PER_M2'
    ELSE 'PER_KG'
  END,
  `regularPrice` = `price`,
  `expressPrice` = CEIL(`price` * 1.5),
  `expressDurationHrs` = GREATEST(1, CEIL(`durationHrs` / 2));

CREATE TABLE `User` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(191) NOT NULL,
  `email` VARCHAR(191) NOT NULL,
  `passwordHash` VARCHAR(191) NOT NULL,
  `role` ENUM('OWNER', 'CASHIER', 'WASHER') NOT NULL,
  `isActive` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `User_email_key`(`email`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ServiceWorkflowStage` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `serviceId` INTEGER NOT NULL,
  `stage` ENUM('WASHING', 'DRYING', 'IRONING') NOT NULL,
  `position` INTEGER NOT NULL,
  UNIQUE INDEX `ServiceWorkflowStage_serviceId_stage_key`(`serviceId`, `stage`),
  UNIQUE INDEX `ServiceWorkflowStage_serviceId_position_key`(`serviceId`, `position`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `ServiceWorkflowStage` (`serviceId`, `stage`, `position`)
SELECT `id`, 'WASHING', 1 FROM `Service` WHERE `name` NOT LIKE '%Setrika Saja%'
UNION ALL
SELECT `id`, 'DRYING', 2 FROM `Service` WHERE `name` NOT LIKE '%Setrika Saja%'
UNION ALL
SELECT `id`, 'IRONING', 3 FROM `Service`
WHERE `name` NOT LIKE '%Cuci Kering Lipat%' AND `name` NOT LIKE '%Setrika Saja%';

INSERT INTO `ServiceWorkflowStage` (`serviceId`, `stage`, `position`)
SELECT `id`, 'IRONING', 1 FROM `Service` WHERE `name` LIKE '%Setrika Saja%';

ALTER TABLE `OrderItem`
  ADD COLUMN `serviceName` VARCHAR(191) NOT NULL DEFAULT '',
  ADD COLUMN `unitCode` ENUM('PER_KG', 'PER_PCS', 'PER_M2') NOT NULL DEFAULT 'PER_KG',
  ADD COLUMN `rateType` ENUM('REGULAR', 'EXPRESS') NOT NULL DEFAULT 'REGULAR',
  ADD COLUMN `durationHrs` INTEGER NOT NULL DEFAULT 48,
  ADD COLUMN `workflowStages` VARCHAR(64) NOT NULL DEFAULT '',
  ADD INDEX `OrderItem_orderId_idx`(`orderId`);

UPDATE `OrderItem` AS `item`
JOIN `Service` AS `service` ON `service`.`id` = `item`.`serviceId`
SET
  `item`.`serviceName` = `service`.`name`,
  `item`.`unitCode` = `service`.`unitCode`,
  `item`.`durationHrs` = `service`.`durationHrs`;

UPDATE `OrderItem` AS `item`
LEFT JOIN (
  SELECT `serviceId`, GROUP_CONCAT(`stage` ORDER BY `position` SEPARATOR ',') AS `stages`
  FROM `ServiceWorkflowStage`
  GROUP BY `serviceId`
) AS `workflow` ON `workflow`.`serviceId` = `item`.`serviceId`
SET `item`.`workflowStages` = COALESCE(`workflow`.`stages`, '');

CREATE TABLE `Session` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `userId` INTEGER NOT NULL,
  `tokenHash` VARCHAR(64) NOT NULL,
  `expiresAt` DATETIME(3) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `Session_tokenHash_key`(`tokenHash`),
  INDEX `Session_expiresAt_idx`(`expiresAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `Payment` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `orderId` INTEGER NOT NULL,
  `amount` INTEGER NOT NULL,
  `method` ENUM('CASH', 'TRANSFER', 'QRIS') NOT NULL,
  `paidAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `staffId` INTEGER NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `Payment_orderId_paidAt_idx`(`orderId`, `paidAt`),
  INDEX `Payment_paidAt_method_idx`(`paidAt`, `method`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `Payment` (`orderId`, `amount`, `method`, `paidAt`, `createdAt`)
SELECT
  `id`,
  `totalAmount`,
  CASE UPPER(COALESCE(`paymentMethod`, 'CASH'))
    WHEN 'TRANSFER' THEN 'TRANSFER'
    WHEN 'QRIS' THEN 'QRIS'
    ELSE 'CASH'
  END,
  `updatedAt`,
  `updatedAt`
FROM `Order`
WHERE `paymentStatus` = 'PAID';

CREATE TABLE `OrderStatusLog` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `orderId` INTEGER NOT NULL,
  `fromStatus` ENUM('RECEIVED', 'QUEUED', 'WASHING', 'DRYING', 'IRONING', 'PACKAGED', 'READY', 'COMPLETED', 'CANCELLED') NULL,
  `toStatus` ENUM('RECEIVED', 'QUEUED', 'WASHING', 'DRYING', 'IRONING', 'PACKAGED', 'READY', 'COMPLETED', 'CANCELLED') NOT NULL,
  `staffId` INTEGER NULL,
  `changedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `OrderStatusLog_orderId_changedAt_idx`(`orderId`, `changedAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `OrderStatusLog` (`orderId`, `fromStatus`, `toStatus`, `changedAt`)
SELECT `id`, NULL, `status`, `createdAt` FROM `Order`;

CREATE TABLE `Complaint` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `orderId` INTEGER NOT NULL,
  `type` ENUM('COLOR_BLEEDING', 'LOST', 'DAMAGED', 'OTHER') NOT NULL,
  `notes` TEXT NOT NULL,
  `status` ENUM('OPEN', 'IN_PROGRESS', 'RESOLVED') NOT NULL DEFAULT 'OPEN',
  `handledById` INTEGER NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  INDEX `Complaint_orderId_status_idx`(`orderId`, `status`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `CashClosure` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `businessDate` DATE NOT NULL,
  `staffId` INTEGER NOT NULL,
  `orderCount` INTEGER NOT NULL,
  `cashTotal` INTEGER NOT NULL,
  `transferTotal` INTEGER NOT NULL,
  `qrisTotal` INTEGER NOT NULL,
  `cashCounted` INTEGER NOT NULL,
  `cashDifference` INTEGER NOT NULL,
  `notes` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `CashClosure_businessDate_staffId_key`(`businessDate`, `staffId`),
  INDEX `CashClosure_businessDate_idx`(`businessDate`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `AppSetting` (
  `key` VARCHAR(191) NOT NULL,
  `value` VARCHAR(191) NOT NULL,
  `updatedById` INTEGER NULL,
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `AppSetting` (`key`, `value`, `updatedAt`)
VALUES ('uncollectedReadyDays', '7', CURRENT_TIMESTAMP(3));

ALTER TABLE `Order`
  ADD CONSTRAINT `Order_createdById_fkey`
  FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `ServiceWorkflowStage`
  ADD CONSTRAINT `ServiceWorkflowStage_serviceId_fkey`
  FOREIGN KEY (`serviceId`) REFERENCES `Service`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `Session`
  ADD CONSTRAINT `Session_userId_fkey`
  FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `Payment`
  ADD CONSTRAINT `Payment_orderId_fkey`
  FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `Payment_staffId_fkey`
  FOREIGN KEY (`staffId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `OrderStatusLog`
  ADD CONSTRAINT `OrderStatusLog_orderId_fkey`
  FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `OrderStatusLog_staffId_fkey`
  FOREIGN KEY (`staffId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `Complaint`
  ADD CONSTRAINT `Complaint_orderId_fkey`
  FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `Complaint_handledById_fkey`
  FOREIGN KEY (`handledById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `CashClosure`
  ADD CONSTRAINT `CashClosure_staffId_fkey`
  FOREIGN KEY (`staffId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `AppSetting`
  ADD CONSTRAINT `AppSetting_updatedById_fkey`
  FOREIGN KEY (`updatedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
