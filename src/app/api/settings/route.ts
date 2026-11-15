import { NextResponse } from 'next/server';
import { errorResponse, parseJsonBody, requireApiUser } from '@/lib/api-utils';
import { prisma } from '@/lib/prisma';
import { settingUpdateSchema } from '@/lib/laundry-validation';

const uncollectedReadyDaysKey = 'uncollectedReadyDays';

export async function GET() {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;
  const setting = await prisma.appSetting.findUnique({ where: { key: uncollectedReadyDaysKey } });
  return NextResponse.json({
    uncollectedReadyDays: Number(setting?.value ?? 7),
  });
}

export async function PATCH(request: Request) {
  const auth = await requireApiUser(['OWNER']);
  if (auth.response) return auth.response;
  const parsed = await parseJsonBody(request, settingUpdateSchema);
  if (parsed.response) return parsed.response;

  try {
    const setting = await prisma.appSetting.upsert({
      where: { key: uncollectedReadyDaysKey },
      update: { value: String(parsed.data.uncollectedReadyDays), updatedById: auth.user.id },
      create: {
        key: uncollectedReadyDaysKey,
        value: String(parsed.data.uncollectedReadyDays),
        updatedById: auth.user.id,
      },
    });
    return NextResponse.json({ uncollectedReadyDays: Number(setting.value) });
  } catch (error) {
    return errorResponse(error, 'Gagal menyimpan pengaturan.');
  }
}
