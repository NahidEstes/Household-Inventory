'use client';

import {
  Copy,
  LogOut,
  Plus,
  ShieldCheck,
  Trash2,
  UserRoundPlus,
  X,
} from 'lucide-react';
import { type SyntheticEvent, useCallback, useEffect, useState } from 'react';

export type AuthState = {
  user: { id: number; email: string; displayName: string | null };
  household: { id: number; name: string; role: 'owner' | 'member' | 'viewer' };
  households: Array<{
    id: number;
    name: string;
    role: 'owner' | 'member' | 'viewer';
  }>;
};

export function HouseholdSwitcher({
  auth,
  onChanged,
  onNotice,
}: {
  auth: AuthState;
  onChanged: () => Promise<void>;
  onNotice: (message: string) => void;
}) {
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  async function switchHousehold(householdId: number) {
    if (householdId === auth.household.id) return;
    const response = await fetch('/api/households', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ householdId }),
    });
    if (!response.ok) return onNotice(await responseMessage(response));
    await onChanged();
    onNotice('Household switched.');
  }

  async function createHousehold(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    const response = await fetch('/api/households', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(
        Object.fromEntries(new FormData(event.currentTarget).entries()),
      ),
    });
    if (!response.ok) return setError(await responseMessage(response));
    setCreating(false);
    await onChanged();
    onNotice('New household created.');
  }

  return (
    <>
      <div className="household-switcher">
        <select
          aria-label="Current household"
          onChange={(event) => void switchHousehold(Number(event.target.value))}
          value={auth.household.id}
        >
          {auth.households.map((household) => (
            <option key={household.id} value={household.id}>
              {household.name} · {household.role}
            </option>
          ))}
        </select>
        <button
          aria-label="Create household"
          className="icon-button"
          onClick={() => setCreating(true)}
          type="button"
        >
          <Plus size={18} />
        </button>
      </div>
      {creating && (
        <div className="dialog-overlay" role="presentation">
          <dialog
            aria-labelledby="create-household-title"
            className="inventory-dialog compact-modal"
            open
          >
            <div className="modal-heading">
              <div>
                <p className="eyebrow">NEW WORKSPACE</p>
                <h2 id="create-household-title">Create household</h2>
              </div>
              <button
                aria-label="Close"
                className="icon-button"
                onClick={() => setCreating(false)}
                type="button"
              >
                <X size={18} />
              </button>
            </div>
            <form className="form-grid" onSubmit={createHousehold}>
              <label>
                Household name
                <input
                  autoFocus
                  maxLength={80}
                  name="name"
                  placeholder="e.g. Family Home"
                  required
                />
              </label>
              {error && (
                <p className="form-error" role="alert">
                  {error}
                </p>
              )}
              <div className="dialog-actions">
                <button
                  className="secondary-button"
                  onClick={() => setCreating(false)}
                  type="button"
                >
                  Cancel
                </button>
                <button className="primary-button" type="submit">
                  Create household
                </button>
              </div>
            </form>
          </dialog>
        </div>
      )}
    </>
  );
}

type Member = {
  membershipId: number;
  userId: number;
  email: string;
  displayName: string | null;
  role: 'owner' | 'member' | 'viewer';
};

type Invitation = {
  id: number;
  email: string;
  role: 'member' | 'viewer';
  expiresAt: string;
  usedAt: string | null;
  revokedAt: string | null;
};

export function AccountSettings({
  auth,
  onNotice,
}: {
  auth: AuthState;
  onNotice: (message: string) => void;
}) {
  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [inviteUrl, setInviteUrl] = useState('');
  const [error, setError] = useState('');
  const isOwner = auth.household.role === 'owner';

  const loadMembers = useCallback(async () => {
    if (!isOwner) return;
    const [memberResponse, inviteResponse] = await Promise.all([
      fetch('/api/households/members'),
      fetch('/api/households/invitations'),
    ]);
    if (!memberResponse.ok || !inviteResponse.ok) return;
    setMembers((await memberResponse.json()) as Member[]);
    setInvitations((await inviteResponse.json()) as Invitation[]);
  }, [isOwner]);

  useEffect(() => {
    queueMicrotask(() => void loadMembers());
  }, [loadMembers, auth.household.id]);

  async function invite(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    const payload = Object.fromEntries(
      new FormData(event.currentTarget).entries(),
    );
    const response = await fetch('/api/households/invitations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const result = (await response.json()) as {
      error?: string;
      invitationUrl?: string;
    };
    if (!response.ok)
      return setError(result.error ?? 'Could not create invitation.');
    setInviteUrl(result.invitationUrl ?? '');
    event.currentTarget.reset();
    await loadMembers();
    onNotice('Invitation link created.');
  }

  async function updateRole(member: Member, role: Member['role']) {
    const response = await fetch('/api/households/members', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ membershipId: member.membershipId, role }),
    });
    if (!response.ok) return setError(await responseMessage(response));
    await loadMembers();
    onNotice(`${member.displayName || member.email} is now ${role}.`);
  }

  async function removeMember(member: Member) {
    if (
      !window.confirm(
        `Remove ${member.displayName || member.email} from this household?`,
      )
    )
      return;
    const response = await fetch(
      `/api/households/members?id=${member.membershipId}`,
      {
        method: 'DELETE',
      },
    );
    if (!response.ok) return setError(await responseMessage(response));
    await loadMembers();
    onNotice('Household member removed.');
  }

  async function revokeInvitation(invitation: Invitation) {
    const response = await fetch(
      `/api/households/invitations?id=${invitation.id}`,
      {
        method: 'DELETE',
      },
    );
    if (!response.ok) return setError(await responseMessage(response));
    await loadMembers();
    onNotice('Invitation cancelled.');
  }

  async function changePassword(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    const form = event.currentTarget;
    const payload = Object.fromEntries(new FormData(form).entries());
    const response = await fetch('/api/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) return setError(await responseMessage(response));
    form.reset();
    onNotice('Password changed. Other devices were signed out.');
  }

  async function logout(allDevices = false) {
    await fetch(allDevices ? '/api/auth/logout-all' : '/api/auth/logout', {
      method: 'POST',
    });
    window.location.replace('/login');
  }

  return (
    <div className="account-settings-grid">
      <section className="panel account-card">
        <div className="panel-heading">
          <div>
            <h2>Account &amp; security</h2>
            <p>{auth.user.email}</p>
          </div>
          <span className="role-badge">
            <ShieldCheck size={15} /> {auth.household.role}
          </span>
        </div>
        <form className="form-grid" onSubmit={changePassword}>
          <label>
            Current password
            <input
              name="currentPassword"
              required
              type="password"
              autoComplete="current-password"
            />
          </label>
          <label>
            New password
            <input
              minLength={12}
              name="newPassword"
              required
              type="password"
              autoComplete="new-password"
            />
          </label>
          <p className="field-hint">Use at least 12 characters.</p>
          <button className="secondary-button" type="submit">
            Change password
          </button>
        </form>
        <div className="account-actions">
          <button
            className="secondary-button"
            onClick={() => void logout(false)}
            type="button"
          >
            <LogOut size={16} /> Log out
          </button>
          <button
            className="secondary-button danger-button"
            onClick={() => void logout(true)}
            type="button"
          >
            Log out all devices
          </button>
        </div>
      </section>

      <section className="panel account-card">
        <div className="panel-heading">
          <div>
            <h2>Households</h2>
            <p>Your role and available workspaces.</p>
          </div>
          <Plus size={18} />
        </div>
        <div className="simple-list">
          {auth.households.map((household) => (
            <div key={household.id}>
              <span>
                <strong>{household.name}</strong>
                <small>
                  {household.id === auth.household.id
                    ? 'Current household'
                    : 'Available'}
                </small>
              </span>
              <span className="role-badge">{household.role}</span>
            </div>
          ))}
        </div>
      </section>

      {isOwner && (
        <section className="panel account-card account-card-wide">
          <div className="panel-heading">
            <div>
              <h2>Members</h2>
              <p>Invite people and control their access.</p>
            </div>
            <UserRoundPlus size={18} />
          </div>
          <form className="invite-form" onSubmit={invite}>
            <input
              aria-label="Email address"
              name="email"
              placeholder="person@example.com"
              required
              type="email"
            />
            <select
              aria-label="Invitation role"
              defaultValue="member"
              name="role"
            >
              <option value="member">Member</option>
              <option value="viewer">Viewer</option>
            </select>
            <button className="primary-button" type="submit">
              Create invite link
            </button>
          </form>
          {inviteUrl && (
            <div className="invite-link">
              <input aria-label="Invitation link" readOnly value={inviteUrl} />
              <button
                className="secondary-button"
                onClick={() =>
                  void navigator.clipboard
                    .writeText(inviteUrl)
                    .then(() => onNotice('Invitation link copied.'))
                }
                type="button"
              >
                <Copy size={16} /> Copy
              </button>
            </div>
          )}
          <div className="member-list">
            {members.map((member) => (
              <div className="member-row" key={member.membershipId}>
                <span>
                  <strong>{member.displayName || member.email}</strong>
                  <small>{member.email}</small>
                </span>
                <select
                  disabled={member.userId === auth.user.id}
                  onChange={(event) =>
                    void updateRole(
                      member,
                      event.target.value as Member['role'],
                    )
                  }
                  value={member.role}
                >
                  <option value="owner">Owner</option>
                  <option value="member">Member</option>
                  <option value="viewer">Viewer</option>
                </select>
                <button
                  aria-label={`Remove ${member.email}`}
                  className="icon-button"
                  disabled={member.userId === auth.user.id}
                  onClick={() => void removeMember(member)}
                  type="button"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
          {invitations.some((item) => !item.usedAt && !item.revokedAt) && (
            <h3 className="subsection-title">Pending invitations</h3>
          )}
          <div className="member-list">
            {invitations
              .filter((item) => !item.usedAt && !item.revokedAt)
              .map((invitation) => (
                <div className="member-row" key={invitation.id}>
                  <span>
                    <strong>{invitation.email}</strong>
                    <small>
                      Expires{' '}
                      {new Date(invitation.expiresAt).toLocaleDateString()}
                    </small>
                  </span>
                  <span className="role-badge">{invitation.role}</span>
                  <button
                    className="secondary-button danger-button"
                    onClick={() => void revokeInvitation(invitation)}
                    type="button"
                  >
                    Cancel
                  </button>
                </div>
              ))}
          </div>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
        </section>
      )}
    </div>
  );
}

async function responseMessage(response: Response) {
  try {
    const data = (await response.json()) as { error?: string };
    return data.error ?? 'Request failed.';
  } catch {
    return 'Request failed.';
  }
}
