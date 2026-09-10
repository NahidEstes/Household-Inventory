import assert from 'node:assert/strict';
import test from 'node:test';
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
