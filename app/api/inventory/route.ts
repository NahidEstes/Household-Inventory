import { desc } from 'drizzle-orm';
import { getDb } from '@/db';
import { inventoryItems } from '@/db/schema';

export async function GET() {
  const rows = await getDb().select().from(inventoryItems).orderBy(desc(inventoryItems.createdAt));
  return Response.json(rows);
}

export async function POST(request: Request) {
  const body = await request.json() as Record<string, unknown>;
  const name = textField(body.name);
  const category = textField(body.category);
  const location = textField(body.location);
  const unit = textField(body.unit);
  const quantity = Number(body.quantity);
  if (!name || !category || !location || !unit || !Number.isFinite(quantity) || quantity <= 0) {
    return Response.json({ error: 'Please provide valid item details.' }, { status: 400 });
  }
  const [item] = await getDb().insert(inventoryItems).values({
    name, category, location, unit, quantity,
    expiryDate: textField(body.expiryDate) || null,
  }).returning();
  return Response.json(item, { status: 201 });
}

function textField(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}
