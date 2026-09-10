export type HouseholdRole = 'owner' | 'member' | 'viewer';
export type Permission = 'read' | 'write' | 'owner';

export function roleAllows(role: HouseholdRole, permission: Permission) {
  if (permission === 'read') return true;
  if (permission === 'write') return role === 'owner' || role === 'member';
  return role === 'owner';
}

export function canChangeMembership(input: {
  actorUserId: number;
  targetUserId: number;
  targetRole: HouseholdRole;
  nextRole?: HouseholdRole;
  ownerCount: number;
  removing?: boolean;
}) {
  if (input.actorUserId === input.targetUserId)
    return input.removing ? false : input.nextRole === 'owner';
  if (input.targetRole === 'owner' && input.ownerCount <= 1)
    return !input.removing && input.nextRole === 'owner';
  return true;
}

export function invitationIsActive(
  input: {
    expiresAt: string;
    usedAt: string | null;
    revokedAt: string | null;
  },
  now = Date.now(),
) {
  return !input.usedAt && !input.revokedAt && Date.parse(input.expiresAt) > now;
}

export function batchIdentity(input: {
  name: string;
  brand?: string | null;
  unit: string;
  location: string;
  specificSpot?: string | null;
  expiryDate?: string | null;
}) {
  return [
    input.name.trim().toLocaleLowerCase('en-US'),
    input.brand?.trim().toLocaleLowerCase('en-US') ?? '',
    input.unit.trim(),
    input.location.trim().toLocaleLowerCase('en-US'),
    input.specificSpot?.trim().toLocaleLowerCase('en-US') ?? '',
    input.expiryDate?.trim() ?? '',
  ].join('|');
}
