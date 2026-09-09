import { asc, eq, sql } from 'drizzle-orm';
import { getDb } from '@/db';
import { householdTasks } from '@/db/schema';

export async function GET() {
  const rows = await getDb()
    .select()
    .from(householdTasks)
    .orderBy(
      asc(householdTasks.completed),
      sql`${householdTasks.dueDate} IS NULL`,
      asc(householdTasks.dueDate),
      asc(householdTasks.createdAt),
    );
  return Response.json(rows);
}

export async function POST(request: Request) {
  const body = (await request.json()) as Record<string, unknown>;
  const title = textField(body.title);
  const dueDate = textField(body.dueDate) || null;
  if (!title || (dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)))
    return Response.json(
      { error: 'Please provide valid task details.' },
      { status: 400 },
    );
  const [task] = await getDb()
    .insert(householdTasks)
    .values({ title, dueDate })
    .returning();
  return Response.json(task, { status: 201 });
}

export async function PATCH(request: Request) {
  const body = (await request.json()) as Record<string, unknown>;
  const id = Number(body.id);
  if (!Number.isInteger(id))
    return Response.json(
      { error: 'A valid task ID is required.' },
      { status: 400 },
    );
  const [task] = await getDb()
    .update(householdTasks)
    .set({ completed: Boolean(body.completed) })
    .where(eq(householdTasks.id, id))
    .returning();
  if (!task)
    return Response.json({ error: 'Task not found.' }, { status: 404 });
  return Response.json(task);
}

export async function DELETE(request: Request) {
  const id = Number(new URL(request.url).searchParams.get('id'));
  if (!Number.isInteger(id))
    return Response.json(
      { error: 'A valid task ID is required.' },
      { status: 400 },
    );
  const [task] = await getDb()
    .delete(householdTasks)
    .where(eq(householdTasks.id, id))
    .returning();
  if (!task)
    return Response.json({ error: 'Task not found.' }, { status: 404 });
  return Response.json({ id: task.id });
}

function textField(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}
