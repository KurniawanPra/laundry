import { prisma } from '@/lib/prisma';
import type { PrismaClient } from '@prisma/client';

/**
 * Returns a Prisma client instance scoped strictly to a specific tenantId.
 * Queries on tenant-owned models automatically enforce `where: { tenantId }`
 * and data creations automatically populate `tenantId`.
 */
export function getTenantPrisma(tenantId: number) {
  return prisma.$extends({
    query: {
      customer: {
        async findMany({ args, query }) {
          args.where = { ...(args.where as any), tenantId };
          return query(args);
        },
        async findFirst({ args, query }) {
          args.where = { ...(args.where as any), tenantId };
          return query(args);
        },
        async findUnique({ args, query }) {
          return prisma.customer.findFirst({
            where: { ...(args.where as any), tenantId },
          });
        },
        async count({ args, query }) {
          args.where = { ...(args.where as any), tenantId };
          return query(args);
        },
        async create({ args, query }) {
          args.data = { ...(args.data as any), tenantId };
          return query(args);
        },
        async update({ args, query }) {
          const exists = await prisma.customer.findFirst({
            where: { ...(args.where as any), tenantId },
            select: { id: true },
          });
          if (!exists) {
            throw new Error('Data pelanggan tidak ditemukan atau bukan milik tenant Anda.');
          }
          return query(args);
        },
        async delete({ args, query }) {
          const exists = await prisma.customer.findFirst({
            where: { ...(args.where as any), tenantId },
            select: { id: true },
          });
          if (!exists) {
            throw new Error('Data pelanggan tidak ditemukan atau bukan milik tenant Anda.');
          }
          return query(args);
        },
      },
      order: {
        async findMany({ args, query }) {
          args.where = { ...(args.where as any), tenantId };
          return query(args);
        },
        async findFirst({ args, query }) {
          args.where = { ...(args.where as any), tenantId };
          return query(args);
        },
        async findUnique({ args, query }) {
          return prisma.order.findFirst({
            where: { ...(args.where as any), tenantId },
            include: args.include,
          });
        },
        async count({ args, query }) {
          args.where = { ...(args.where as any), tenantId };
          return query(args);
        },
        async create({ args, query }) {
          args.data = { ...(args.data as any), tenantId };
          return query(args);
        },
        async update({ args, query }) {
          const exists = await prisma.order.findFirst({
            where: { ...(args.where as any), tenantId },
            select: { id: true },
          });
          if (!exists) {
            throw new Error('Data order tidak ditemukan atau bukan milik tenant Anda.');
          }
          return query(args);
        },
        async delete({ args, query }) {
          const exists = await prisma.order.findFirst({
            where: { ...(args.where as any), tenantId },
            select: { id: true },
          });
          if (!exists) {
            throw new Error('Data order tidak ditemukan atau bukan milik tenant Anda.');
          }
          return query(args);
        },
      },
      service: {
        async findMany({ args, query }) {
          args.where = { ...(args.where as any), tenantId };
          return query(args);
        },
        async findFirst({ args, query }) {
          args.where = { ...(args.where as any), tenantId };
          return query(args);
        },
        async findUnique({ args, query }) {
          return prisma.service.findFirst({
            where: { ...(args.where as any), tenantId },
            include: args.include,
          });
        },
        async create({ args, query }) {
          args.data = { ...(args.data as any), tenantId };
          return query(args);
        },
        async update({ args, query }) {
          const exists = await prisma.service.findFirst({
            where: { ...(args.where as any), tenantId },
            select: { id: true },
          });
          if (!exists) {
            throw new Error('Data layanan tidak ditemukan atau bukan milik tenant Anda.');
          }
          return query(args);
        },
      },
      store: {
        async findMany({ args, query }) {
          args.where = { ...(args.where as any), tenantId };
          return query(args);
        },
        async findFirst({ args, query }) {
          args.where = { ...(args.where as any), tenantId };
          return query(args);
        },
        async findUnique({ args, query }) {
          return prisma.store.findFirst({
            where: { ...(args.where as any), tenantId },
            include: args.include,
          });
        },
        async create({ args, query }) {
          args.data = { ...(args.data as any), tenantId };
          return query(args);
        },
        async update({ args, query }) {
          const exists = await prisma.store.findFirst({
            where: { ...(args.where as any), tenantId },
            select: { id: true },
          });
          if (!exists) {
            throw new Error('Data toko tidak ditemukan atau bukan milik tenant Anda.');
          }
          return query(args);
        },
      },
      laundrySpeed: {
        async findMany({ args, query }) {
          args.where = { ...(args.where as any), tenantId };
          return query(args);
        },
        async findFirst({ args, query }) {
          args.where = { ...(args.where as any), tenantId };
          return query(args);
        },
        async create({ args, query }) {
          args.data = { ...(args.data as any), tenantId };
          return query(args);
        },
      },
      cashClosure: {
        async findMany({ args, query }) {
          args.where = { ...(args.where as any), tenantId };
          return query(args);
        },
        async findFirst({ args, query }) {
          args.where = { ...(args.where as any), tenantId };
          return query(args);
        },
        async create({ args, query }) {
          args.data = { ...(args.data as any), tenantId };
          return query(args);
        },
      },
    },
  });
}

export type ScopedPrismaClient = ReturnType<typeof getTenantPrisma>;
