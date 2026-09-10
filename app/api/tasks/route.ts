import { and, asc, eq, sql } from 'drizzle-orm';
import { getDb } from '@/db';
import { householdTasks } from '@/db/schema';
import { requireApiContext } from '@/lib/auth';

export async function GET(request: Request) {
  const context = await requireApiContext(request);
  if (context instanceof Response) return context;
  const rows = await getDb()
    .select()
    .from(householdTasks)
    .where(eq(householdTasks.householdId, context.household.id))
    .orderBy(
      asc(householdTasks.completed),
      sql`${householdTasks.dueDate} IS NULL`,
      asc(householdTasks.dueDate),
      asc(householdTasks.createdAt),
    );
  return Response.json(rows);
}

export async function POST(request: Request) {
  const context = await requireApiContext(request, 'write');
  if (context instanceof Response) return context;
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
    .values({ householdId: context.household.id, title, dueDate })
    .returning();
  return Response.json(task, { status: 201 });
}

export async function PATCH(request: Request) {
  const context = await requireApiContext(request, 'write');
  if (context instanceof Response) return context;
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
    .where(
      and(
        eq(householdTasks.id, id),
        eq(householdTasks.householdId, context.household.id),
      ),
    )
    .returning();
  if (!task)
    return Response.json({ error: 'Task not found.' }, { status: 404 });
  return Response.json(task);
}

export async function DELETE(request: Request) {
  const context = await requireApiContext(request, 'write');
  if (context instanceof Response) return context;
  const id = Number(new URL(request.url).searchParams.get('id'));
  if (!Number.isInteger(id))
    return Response.json(
      { error: 'A valid task ID is required.' },
      { status: 400 },
    );
  const [task] = await getDb()
    .delete(householdTasks)
    .where(
      and(
        eq(householdTasks.id, id),
        eq(householdTasks.householdId, context.household.id),
      ),
    )
    .returning();
  if (!task)
    return Response.json({ error: 'Task not found.' }, { status: 404 });
  return Response.json({ id: task.id });
}

function textField(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}
