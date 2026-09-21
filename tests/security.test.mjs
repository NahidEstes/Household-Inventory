import assert from 'node:assert/strict';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import {
  batchIdentity,
  canChangeMembership,
  invitationIsActive,
  roleAllows,
} from '../lib/authorization.ts';
import {
  PASSWORD_ITERATIONS,
  hashPassword,
  normalizeEmail,
  normalizeName,
  sha256,
  verifyPassword,
} from '../lib/security-core.ts';
import {
  addQuantities,
  formatQuantity,
  isValidQuantity,
  planPurchaseQuantityAdjustment,
} from '../lib/quantity.ts';
import {
  aggregateEssentialStock,
  essentialShoppingQuantity,
  essentialStatus,
} from '../lib/essentials-core.ts';
import { AUTO_ADD_ESSENTIALS_SQL } from '../lib/essentials-sql.ts';

test('essentials combine expiry batches without creating separate stock', () => {
  const product = { normalizedName: 'milk', normalizedBrand: '', unit: 'L' };
  const batches = [
    {
      name: 'Milk',
      normalizedName: 'milk',
      brand: null,
      normalizedBrand: '',
      unit: 'L',
      quantity: 0.25,
      category: 'Dairy',
      location: 'Fridge',
    },
    {
      name: 'Milk',
      normalizedName: 'milk',
      brand: null,
      normalizedBrand: '',
      unit: 'L',
      quantity: 0.75,
      category: 'Dairy',
      location: 'Fridge',
    },
    {
      name: 'Milk',
      normalizedName: 'milk',
      brand: null,
      normalizedBrand: '',
      unit: 'pcs',
      quantity: 4,
      category: 'Dairy',
      location: 'Fridge',
    },
  ];
  const result = aggregateEssentialStock(product, batches, normalizeName);
  assert.equal(result.currentStock, 1);
  assert.equal(result.matching.length, 2);
  assert.equal(essentialStatus(1, 1), 'Buy Soon');
  assert.equal(essentialStatus(0.5, 1), 'Low Stock');
  assert.equal(essentialStatus(0, 1), 'Out of Stock');
  assert.equal(essentialStatus(1.001, 1), 'In Stock');
  assert.equal(essentialShoppingQuantity(0.9, 1), 0.1);
});

test('auto-add uses combined stock and never duplicates an active shopping item', () => {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    CREATE TABLE essential_items (household_id INTEGER, name TEXT, normalized_name TEXT, normalized_brand TEXT, unit TEXT, minimum_stock REAL, auto_add_to_shopping_list INTEGER);
    CREATE TABLE household_settings (household_id INTEGER, auto_add_essentials INTEGER);
    CREATE TABLE inventory_items (household_id INTEGER, name TEXT, normalized_name TEXT, brand TEXT, normalized_brand TEXT, unit TEXT, quantity REAL);
    CREATE TABLE shopping_items (household_id INTEGER, name TEXT, quantity REAL, unit TEXT, completed INTEGER);
    INSERT INTO household_settings VALUES (1, 1);
    INSERT INTO essential_items VALUES (1, 'Milk', 'milk', '', 'L', 2, 1);
    INSERT INTO inventory_items VALUES (1, 'Milk', 'milk', NULL, '', 'L', 0.5);
    INSERT INTO inventory_items VALUES (1, 'Milk', 'milk', NULL, '', 'L', 0.75);
  `);
  const sync = db.prepare(AUTO_ADD_ESSENTIALS_SQL);
  sync.run(1);
  sync.run(1);
  assert.deepEqual(
    db
      .prepare('SELECT name, quantity, unit FROM shopping_items')
      .all()
      .map((row) => ({ ...row })),
    [{ name: 'Milk', quantity: 0.75, unit: 'L' }],
  );
  db.exec('UPDATE inventory_items SET quantity = 2 WHERE quantity = 0.5');
  sync.run(1);
  assert.equal(
    db.prepare('SELECT COUNT(*) AS count FROM shopping_items').get().count,
    1,
  );
  db.close();
});

test('password hashes are salted and verifiable', async () => {
  const first = await hashPassword('correct horse battery staple');
  const second = await hashPassword('correct horse battery staple');
  assert.notEqual(first, second);
  assert.equal(
    await verifyPassword('correct horse battery staple', first),
    true,
  );
  assert.equal(await verifyPassword('incorrect password', first), false);
  assert.equal(Number(first.split('$')[1]), PASSWORD_ITERATIONS);
  assert.equal(PASSWORD_ITERATIONS, 100_000);
});

test('raw tokens can be stored as hashes without revealing the token', async () => {
  const token = 'private-invitation-token';
  const digest = await sha256(token);
  assert.notEqual(digest, token);
  assert.equal(digest, await sha256(token));
});

test('email, product and brand identities are case insensitive', () => {
  assert.equal(normalizeEmail(' Owner@Example.COM '), 'owner@example.com');
  assert.equal(normalizeName('  Tomato  Sauce '), 'tomato sauce');
  assert.equal(
    batchIdentity({
      name: 'Milk',
      brand: 'Almarai',
      unit: 'L',
      location: 'Fridge',
      specificSpot: 'Top Shelf',
      expiryDate: '2026-09-20',
    }),
    batchIdentity({
      name: ' milk ',
      brand: 'ALMARAI',
      unit: 'L',
      location: 'fridge',
      specificSpot: 'top shelf',
      expiryDate: '2026-09-20',
    }),
  );
});

test('different brand, location or expiry remains a separate inventory batch', () => {
  const base = {
    name: 'Milk',
    brand: 'Almarai',
    unit: 'L',
    location: 'Fridge',
    specificSpot: 'Top shelf',
    expiryDate: '2026-09-20',
  };
  assert.notEqual(
    batchIdentity(base),
    batchIdentity({ ...base, brand: 'Nadec' }),
  );
  assert.notEqual(
    batchIdentity(base),
    batchIdentity({ ...base, location: 'Freezer' }),
  );
  assert.notEqual(
    batchIdentity(base),
    batchIdentity({ ...base, expiryDate: '2026-09-25' }),
  );
});

test('quantities keep three-decimal accuracy without trailing zeroes', () => {
  assert.equal(isValidQuantity(1.235), true);
  assert.equal(isValidQuantity(1.2345), false);
  assert.equal(addQuantities(0.1, 0.2), 0.3);
  assert.equal(formatQuantity(1), '1');
  assert.equal(formatQuantity(1.25), '1.25');
  assert.equal(formatQuantity(1.235), '1.235');
});

test('purchase quantity edits reconcile stock and block unsafe changes', () => {
  assert.deepEqual(
    planPurchaseQuantityAdjustment({
      currentBatchQuantity: 4,
      currentPurchaseQuantity: 2.5,
      newPurchaseQuantity: 3,
      identityChanged: false,
    }),
    {
      allowed: true,
      currentBatchAfter: 4.5,
      currentBatchChange: 0.5,
      targetQuantityToAdd: 0,
    },
  );
  assert.deepEqual(
    planPurchaseQuantityAdjustment({
      currentBatchQuantity: 0.4,
      currentPurchaseQuantity: 2.5,
      newPurchaseQuantity: 2,
      identityChanged: false,
    }),
    { allowed: false },
  );
  assert.deepEqual(
    planPurchaseQuantityAdjustment({
      currentBatchQuantity: 2,
      currentPurchaseQuantity: 2.5,
      newPurchaseQuantity: 2.5,
      identityChanged: true,
    }),
    { allowed: false },
  );
});

test('roles enforce read, write and owner boundaries', () => {
  assert.equal(roleAllows('viewer', 'read'), true);
  assert.equal(roleAllows('viewer', 'write'), false);
  assert.equal(roleAllows('member', 'write'), true);
  assert.equal(roleAllows('member', 'owner'), false);
  assert.equal(roleAllows('owner', 'owner'), true);
});

test('last owner and self-removal protections hold', () => {
  assert.equal(
    canChangeMembership({
      actorUserId: 1,
      targetUserId: 1,
      targetRole: 'owner',
      ownerCount: 2,
      removing: true,
    }),
    false,
  );
  assert.equal(
    canChangeMembership({
      actorUserId: 1,
      targetUserId: 2,
      targetRole: 'owner',
      ownerCount: 1,
      removing: true,
    }),
    false,
  );
  assert.equal(
    canChangeMembership({
      actorUserId: 1,
      targetUserId: 2,
      targetRole: 'member',
      ownerCount: 1,
      removing: true,
    }),
    true,
  );
});

test('invitation requires unused, unrevoked and future expiry state', () => {
  const future = new Date(Date.now() + 60_000).toISOString();
  assert.equal(
    invitationIsActive({ expiresAt: future, usedAt: null, revokedAt: null }),
    true,
  );
  assert.equal(
    invitationIsActive({
      expiresAt: future,
      usedAt: new Date().toISOString(),
      revokedAt: null,
    }),
    false,
  );
  assert.equal(
    invitationIsActive({
      expiresAt: new Date(0).toISOString(),
      usedAt: null,
      revokedAt: null,
    }),
    false,
  );
});
