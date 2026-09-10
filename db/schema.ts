import {
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const users = sqliteTable(
  'users',
  {
    id: integer('id').primaryKey(),
    email: text('email').notNull(),
    normalizedEmail: text('normalized_email').notNull(),
    displayName: text('display_name'),
    passwordHash: text('password_hash').notNull(),
    status: text('status').notNull().default('active'),
    passwordChangedAt: text('password_changed_at'),
    createdAt: text('created_at')
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex('idx_users_normalized_email').on(table.normalizedEmail),
  ],
);

export const households = sqliteTable(
  'households',
  {
    id: integer('id').primaryKey(),
    name: text('name').notNull(),
    createdByUserId: integer('created_by_user_id').references(() => users.id),
    createdAt: text('created_at')
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index('idx_households_created_by').on(table.createdByUserId)],
);

export const householdMemberships = sqliteTable(
  'household_memberships',
  {
    id: integer('id').primaryKey(),
    householdId: integer('household_id')
      .notNull()
      .references(() => households.id),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id),
    role: text('role').notNull(),
    createdAt: text('created_at')
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex('idx_household_memberships_household_user').on(
      table.householdId,
      table.userId,
    ),
    index('idx_household_memberships_user').on(table.userId),
  ],
);

export const sessions = sqliteTable(
  'sessions',
  {
    id: integer('id').primaryKey(),
    tokenHash: text('token_hash').notNull(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id),
    selectedHouseholdId: integer('selected_household_id').references(
      () => households.id,
    ),
    expiresAt: text('expires_at').notNull(),
    revokedAt: text('revoked_at'),
    lastSeenAt: text('last_seen_at').notNull(),
    userAgent: text('user_agent'),
    createdAt: text('created_at')
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex('idx_sessions_token_hash').on(table.tokenHash),
    index('idx_sessions_user_active').on(
      table.userId,
      table.revokedAt,
      table.expiresAt,
    ),
  ],
);

export const householdInvitations = sqliteTable(
  'household_invitations',
  {
    id: integer('id').primaryKey(),
    householdId: integer('household_id')
      .notNull()
      .references(() => households.id),
    email: text('email').notNull(),
    normalizedEmail: text('normalized_email').notNull(),
    role: text('role').notNull(),
    tokenHash: text('token_hash').notNull(),
    invitedByUserId: integer('invited_by_user_id')
      .notNull()
      .references(() => users.id),
    expiresAt: text('expires_at').notNull(),
    usedAt: text('used_at'),
    revokedAt: text('revoked_at'),
    createdAt: text('created_at')
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex('idx_household_invitations_token_hash').on(table.tokenHash),
    index('idx_household_invitations_household_email').on(
      table.householdId,
      table.normalizedEmail,
    ),
  ],
);

export const authRateLimits = sqliteTable('auth_rate_limits', {
  keyHash: text('key_hash').primaryKey(),
  attempts: integer('attempts').notNull().default(0),
  windowStartedAt: text('window_started_at').notNull(),
  blockedUntil: text('blocked_until'),
  updatedAt: text('updated_at')
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export const productBrands = sqliteTable(
  'product_brands',
  {
    id: integer('id').primaryKey(),
    householdId: integer('household_id')
      .notNull()
      .references(() => households.id),
    name: text('name').notNull(),
    normalizedName: text('normalized_name').notNull(),
    createdAt: text('created_at')
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex('idx_product_brands_household_normalized').on(
      table.householdId,
      table.normalizedName,
    ),
  ],
);

export const inventoryItems = sqliteTable(
  'inventory_items',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    name: text('name').notNull(),
    normalizedName: text('normalized_name'),
    brand: text('brand'),
    normalizedBrand: text('normalized_brand'),
    householdId: integer('household_id').references(() => households.id),
    category: text('category').notNull(),
    quantity: real('quantity').notNull(),
    unit: text('unit').notNull(),
    location: text('location').notNull(),
    specificSpot: text('specific_spot'),
    expiryDate: text('expiry_date'),
    createdAt: text('created_at')
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index('idx_inventory_household_product').on(
      table.householdId,
      table.normalizedName,
      table.normalizedBrand,
    ),
    index('idx_inventory_household_expiry').on(
      table.householdId,
      table.expiryDate,
    ),
  ],
);

export const productCategories = sqliteTable(
  'product_categories',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    name: text('name').notNull(),
    normalizedName: text('normalized_name').notNull(),
    householdId: integer('household_id').references(() => households.id),
    createdAt: text('created_at')
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex('idx_product_categories_household_normalized_name').on(
      table.householdId,
      table.normalizedName,
    ),
  ],
);

export const stockChanges = sqliteTable(
  'stock_changes',
  {
    id: integer('id').primaryKey(),
    inventoryItemId: integer('inventory_item_id').notNull(),
    itemName: text('item_name').notNull(),
    normalizedName: text('normalized_name'),
    brand: text('brand'),
    normalizedBrand: text('normalized_brand'),
    householdId: integer('household_id').references(() => households.id),
    unit: text('unit').notNull(),
    quantityChange: real('quantity_change').notNull(),
    quantityBefore: real('quantity_before').notNull(),
    quantityAfter: real('quantity_after').notNull(),
    reason: text('reason').notNull(),
    note: text('note'),
    createdAt: text('created_at')
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index('idx_stock_changes_inventory_created').on(
      table.inventoryItemId,
      table.createdAt,
    ),
    index('idx_stock_changes_household_created').on(
      table.householdId,
      table.createdAt,
    ),
  ],
);

export const expenses = sqliteTable(
  'expenses',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    amount: real('amount').notNull(),
    householdId: integer('household_id').references(() => households.id),
    category: text('category').notNull(),
    note: text('note'),
    spentAt: text('spent_at').notNull(),
    createdAt: text('created_at')
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index('idx_expenses_household_spent').on(table.householdId, table.spentAt),
  ],
);

export const purchases = sqliteTable(
  'purchases',
  {
    id: integer('id').primaryKey(),
    itemName: text('item_name').notNull(),
    normalizedName: text('normalized_name'),
    brand: text('brand'),
    normalizedBrand: text('normalized_brand'),
    householdId: integer('household_id').references(() => households.id),
    category: text('category').notNull(),
    quantity: real('quantity').notNull(),
    unit: text('unit').notNull(),
    totalPrice: real('total_price').notNull(),
    purchasedAt: text('purchased_at').notNull(),
    expiryDate: text('expiry_date'),
    store: text('store'),
    location: text('location').notNull(),
    specificSpot: text('specific_spot'),
    inventoryItemId: integer('inventory_item_id').notNull(),
    expenseId: integer('expense_id').notNull(),
    createdAt: text('created_at')
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index('idx_purchases_household_product_date').on(
      table.householdId,
      table.normalizedName,
      table.normalizedBrand,
      table.purchasedAt,
    ),
  ],
);

export const shoppingItems = sqliteTable(
  'shopping_items',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    name: text('name').notNull(),
    householdId: integer('household_id').references(() => households.id),
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
    index('idx_shopping_items_household_status_date').on(
      table.householdId,
      table.completed,
      table.scheduledDate,
    ),
  ],
);

export const mealPlans = sqliteTable(
  'meal_plans',
  {
    id: integer('id').primaryKey(),
    name: text('name').notNull(),
    householdId: integer('household_id').references(() => households.id),
    plannedDate: text('planned_date').notNull(),
    plannedTime: text('planned_time'),
    notes: text('notes'),
    thumbnailUrl: text('thumbnail_url'),
    createdAt: text('created_at')
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index('idx_meal_plans_planned_date').on(table.plannedDate),
    index('idx_meal_plans_household_date').on(
      table.householdId,
      table.plannedDate,
    ),
  ],
);

export const mealIngredients = sqliteTable(
  'meal_ingredients',
  {
    id: integer('id').primaryKey(),
    mealId: integer('meal_id').notNull(),
    householdId: integer('household_id').references(() => households.id),
    name: text('name').notNull(),
    quantity: real('quantity').notNull().default(1),
    unit: text('unit').notNull().default('pcs'),
    inventoryItemId: integer('inventory_item_id'),
    estimatedPrice: real('estimated_price'),
    createdAt: text('created_at')
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index('idx_meal_ingredients_meal_id').on(table.mealId),
    index('idx_meal_ingredients_household_meal').on(
      table.householdId,
      table.mealId,
    ),
  ],
);

export const householdTasks = sqliteTable(
  'household_tasks',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    title: text('title').notNull(),
    householdId: integer('household_id').references(() => households.id),
    dueDate: text('due_date'),
    completed: integer('completed', { mode: 'boolean' })
      .notNull()
      .default(false),
    createdAt: text('created_at')
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index('idx_household_tasks_due_date').on(table.dueDate),
    index('idx_household_tasks_household_due').on(
      table.householdId,
      table.dueDate,
    ),
  ],
);

export const householdSettings = sqliteTable(
  'household_settings',
  {
    id: integer('id').primaryKey(),
    householdId: integer('household_id').references(() => households.id),
    householdName: text('household_name').notNull().default('My Household'),
    monthlyBudget: real('monthly_budget').notNull().default(30000),
    updatedAt: text('updated_at')
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex('idx_household_settings_household').on(table.householdId),
  ],
);
