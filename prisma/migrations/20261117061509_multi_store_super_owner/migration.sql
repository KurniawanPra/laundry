-- AlterTable
ALTER TABLE `cashclosure` ADD COLUMN `storeId` INTEGER NULL;

-- AlterTable
ALTER TABLE `customer` ADD COLUMN `storeId` INTEGER NULL;

-- AlterTable
ALTER TABLE `laundryspeed` ADD COLUMN `storeId` INTEGER NULL;

-- AlterTable
ALTER TABLE `order` ADD COLUMN `storeId` INTEGER NULL;

-- AlterTable
ALTER TABLE `service` ADD COLUMN `storeId` INTEGER NULL;

-- AlterTable
ALTER TABLE `user` MODIFY `role` ENUM('SUPER_OWNER', 'OWNER', 'CASHIER', 'WASHER') NOT NULL;

-- CreateTable
CREATE TABLE `Store` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `address` TEXT NULL,
    `phone` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `ownerId` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Store_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `StoreUser` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `storeId` INTEGER NOT NULL,
    `role` ENUM('SUPER_OWNER', 'OWNER', 'CASHIER', 'WASHER') NOT NULL,

    INDEX `StoreUser_userId_idx`(`userId`),
    INDEX `StoreUser_storeId_idx`(`storeId`),
    UNIQUE INDEX `StoreUser_userId_storeId_key`(`userId`, `storeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `CashClosure_storeId_idx` ON `CashClosure`(`storeId`);

-- CreateIndex
CREATE INDEX `Customer_storeId_idx` ON `Customer`(`storeId`);

-- CreateIndex
CREATE INDEX `LaundrySpeed_storeId_idx` ON `LaundrySpeed`(`storeId`);

-- CreateIndex
CREATE INDEX `Order_storeId_idx` ON `Order`(`storeId`);

-- CreateIndex
CREATE INDEX `Service_storeId_idx` ON `Service`(`storeId`);

-- AddForeignKey
ALTER TABLE `Store` ADD CONSTRAINT `Store_ownerId_fkey` FOREIGN KEY (`ownerId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StoreUser` ADD CONSTRAINT `StoreUser_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StoreUser` ADD CONSTRAINT `StoreUser_storeId_fkey` FOREIGN KEY (`storeId`) REFERENCES `Store`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Customer` ADD CONSTRAINT `Customer_storeId_fkey` FOREIGN KEY (`storeId`) REFERENCES `Store`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Service` ADD CONSTRAINT `Service_storeId_fkey` FOREIGN KEY (`storeId`) REFERENCES `Store`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LaundrySpeed` ADD CONSTRAINT `LaundrySpeed_storeId_fkey` FOREIGN KEY (`storeId`) REFERENCES `Store`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Order` ADD CONSTRAINT `Order_storeId_fkey` FOREIGN KEY (`storeId`) REFERENCES `Store`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CashClosure` ADD CONSTRAINT `CashClosure_storeId_fkey` FOREIGN KEY (`storeId`) REFERENCES `Store`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
