import {
  index,
  integer,
  real,
  sqliteTable,
  text,
} from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const inventoryItems = sqliteTable('inventory_items', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  category: text('category').notNull(),
  quantity: real('quantity').notNull(),
  unit: text('unit').notNull(),
  location: text('location').notNull(),
  specificSpot: text('specific_spot'),
  expiryDate: text('expiry_date'),
  createdAt: text('created_at')
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export const expenses = sqliteTable('expenses', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  amount: real('amount').notNull(),
  category: text('category').notNull(),
  note: text('note'),
  spentAt: text('spent_at').notNull(),
  createdAt: text('created_at')
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export const purchases = sqliteTable('purchases', {
  id: integer('id').primaryKey(),
  itemName: text('item_name').notNull(),
  category: text('category').notNull(),
  quantity: real('quantity').notNull(),
  unit: text('unit').notNull(),
  totalPrice: real('total_price').notNull(),
  purchasedAt: text('purchased_at').notNull(),
  expiryDate: text('expiry_date'),
  store: text('store'),
  location: text('location').notNull(),
  inventoryItemId: integer('inventory_item_id').notNull(),
  expenseId: integer('expense_id').notNull(),
  createdAt: text('created_at')
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export const shoppingItems = sqliteTable(
  'shopping_items',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    name: text('name').notNull(),
    quantity: real('quantity').notNull().default(1),
    unit: text('unit').notNull().default('pcs'),
    estimatedPrice: real('estimated_price'),
    scheduledDate: text('scheduled_date'),
    completed: integer('completed', { mode: 'boolean' })
      .notNull()
      .default(false),
    createdAt: text('created_at')
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index('idx_shopping_items_scheduled_date').on(table.scheduledDate),
  ],
);

export const mealPlans = sqliteTable(
  'meal_plans',
  {
    id: integer('id').primaryKey(),
    name: text('name').notNull(),
    plannedDate: text('planned_date').notNull(),
    plannedTime: text('planned_time'),
    notes: text('notes'),
    thumbnailUrl: text('thumbnail_url'),
    createdAt: text('created_at')
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index('idx_meal_plans_planned_date').on(table.plannedDate)],
);

export const mealIngredients = sqliteTable(
  'meal_ingredients',
  {
    id: integer('id').primaryKey(),
    mealId: integer('meal_id').notNull(),
    name: text('name').notNull(),
    quantity: real('quantity').notNull().default(1),
    unit: text('unit').notNull().default('pcs'),
    inventoryItemId: integer('inventory_item_id'),
    estimatedPrice: real('estimated_price'),
    createdAt: text('created_at')
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index('idx_meal_ingredients_meal_id').on(table.mealId)],
);

export const householdTasks = sqliteTable(
  'household_tasks',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    title: text('title').notNull(),
    dueDate: text('due_date'),
    completed: integer('completed', { mode: 'boolean' })
      .notNull()
      .default(false),
    createdAt: text('created_at')
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index('idx_household_tasks_due_date').on(table.dueDate)],
);

export const householdSettings = sqliteTable('household_settings', {
  id: integer('id').primaryKey(),
  householdName: text('household_name').notNull().default('My Household'),
  monthlyBudget: real('monthly_budget').notNull().default(30000),
  updatedAt: text('updated_at')
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});
