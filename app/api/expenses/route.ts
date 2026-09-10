import { and, desc, eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { expenses } from '@/db/schema';
import { requireApiContext } from '@/lib/auth';

export async function GET(request: Request) {
  const context = await requireApiContext(request);
  if (context instanceof Response) return context;
  const rows = await getDb()
    .select()
    .from(expenses)
    .where(eq(expenses.householdId, context.household.id))
    .orderBy(desc(expenses.spentAt));
  return Response.json(rows);
}

export async function POST(request: Request) {
  const context = await requireApiContext(request, 'write');
  if (context instanceof Response) return context;
  const body = (await request.json()) as Record<string, unknown>;
  const amount = Number(body.amount);
  const category = textField(body.category);
  const spentAt = textField(body.spentAt);
  if (!Number.isFinite(amount) || amount <= 0 || !category || !spentAt) {
    return Response.json(
      { error: 'Please provide a valid expense.' },
      { status: 400 },
    );
  }
  const [expense] = await getDb()
    .insert(expenses)
    .values({
      householdId: context.household.id,
      amount,
      category,
      spentAt,
      note: textField(body.note) || null,
    })
    .returning();
  return Response.json(expense, { status: 201 });
}

export async function DELETE(request: Request) {
  const context = await requireApiContext(request, 'write');
  if (context instanceof Response) return context;
  const id = Number(new URL(request.url).searchParams.get('id'));
  if (!Number.isInteger(id))
    return Response.json(
      { error: 'A valid expense ID is required.' },
      { status: 400 },
    );
  const [expense] = await getDb()
    .delete(expenses)
    .where(
      and(eq(expenses.id, id), eq(expenses.householdId, context.household.id)),
    )
    .returning();
  if (!expense)
    return Response.json({ error: 'Expense not found.' }, { status: 404 });
  return Response.json({ id: expense.id });
}

function textField(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}
