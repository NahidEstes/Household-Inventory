import { desc } from 'drizzle-orm';
import { getDb } from '@/db';
import { expenses } from '@/db/schema';

export async function GET() {
  const rows = await getDb().select().from(expenses).orderBy(desc(expenses.spentAt));
  return Response.json(rows);
}

export async function POST(request: Request) {
  const body = await request.json() as Record<string, unknown>;
  const amount = Number(body.amount);
  const category = textField(body.category);
  const spentAt = textField(body.spentAt);
  if (!Number.isFinite(amount) || amount <= 0 || !category || !spentAt) {
    return Response.json({ error: 'Please provide a valid expense.' }, { status: 400 });
  }
  const [expense] = await getDb().insert(expenses).values({
    amount, category, spentAt, note: textField(body.note) || null,
  }).returning();
  return Response.json(expense, { status: 201 });
}

function textField(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}
