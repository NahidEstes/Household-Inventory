import { desc, eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { shoppingItems } from '@/db/schema';

export async function GET() {
  const rows = await getDb()
    .select()
    .from(shoppingItems)
    .orderBy(desc(shoppingItems.createdAt));
  return Response.json(rows);
}

export async function POST(request: Request) {
  const body = (await request.json()) as Record<string, unknown>;
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name)
    return Response.json({ error: 'Item name is required.' }, { status: 400 });
  const [item] = await getDb()
    .insert(shoppingItems)
    .values({ name })
    .returning();
  return Response.json(item, { status: 201 });
}

export async function PATCH(request: Request) {
  const body = (await request.json()) as Record<string, unknown>;
  const id = Number(body.id);
  if (!Number.isInteger(id))
    return Response.json(
      { error: 'A valid item ID is required.' },
      { status: 400 },
    );
  const [item] = await getDb()
    .update(shoppingItems)
    .set({ completed: Boolean(body.completed) })
    .where(eq(shoppingItems.id, id))
    .returning();
  return Response.json(item);
}

export async function DELETE(request: Request) {
  const id = Number(new URL(request.url).searchParams.get('id'));
  if (!Number.isInteger(id))
    return Response.json(
      { error: 'A valid item ID is required.' },
      { status: 400 },
    );
  const [item] = await getDb()
    .delete(shoppingItems)
    .where(eq(shoppingItems.id, id))
    .returning();
  if (!item)
    return Response.json({ error: 'Item not found.' }, { status: 404 });
  return Response.json({ id: item.id });
}
