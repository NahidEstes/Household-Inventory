'use client';

import { ArrowRight, Home, LockKeyhole, UserRoundPlus } from 'lucide-react';
import Link from 'next/link';
import { type SyntheticEvent, useEffect, useState } from 'react';

export function LoginScreen() {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void fetch('/api/auth/me').then((response) => {
      if (response.ok) window.location.replace('/');
    });
  }, []);

  async function submit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(
        Object.fromEntries(new FormData(event.currentTarget).entries()),
      ),
    });
    const data = (await response.json()) as { error?: string };
    if (!response.ok) {
      setBusy(false);
      return setError(data.error ?? 'Could not sign in.');
    }
    const returnTo = new URLSearchParams(window.location.search).get(
      'returnTo',
    );
    window.location.replace(
      returnTo?.startsWith('/') && !returnTo.startsWith('//') ? returnTo : '/',
    );
  }

  return (
    <AuthShell
      eyebrow="PRIVATE HOUSEHOLD"
      title="Welcome back"
      subtitle="Sign in to your Homely workspace."
    >
      <form className="auth-form" onSubmit={submit}>
        <label>
          Email
          <input autoComplete="email" name="email" required type="email" />
        </label>
        <label>
          Password
          <input
            autoComplete="current-password"
            name="password"
            required
            type="password"
          />
        </label>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button
          className="primary-button auth-submit"
          disabled={busy}
          type="submit"
        >
          {busy ? 'Signing in…' : 'Sign in'} <ArrowRight size={17} />
        </button>
      </form>
      <p className="auth-footnote">
        Homely is invite-only. Ask a household owner for an invitation link.
      </p>
    </AuthShell>
  );
}

export function SetupScreen() {
  const [status, setStatus] = useState<{
    required: boolean;
    configured: boolean;
  } | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void fetch('/api/auth/bootstrap').then(async (response) => {
      if (response.ok)
        setStatus(
          (await response.json()) as { required: boolean; configured: boolean },
        );
    });
  }, []);

  async function submit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const response = await fetch('/api/auth/bootstrap', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(
        Object.fromEntries(new FormData(event.currentTarget).entries()),
      ),
    });
    const data = (await response.json()) as { error?: string };
    if (!response.ok) {
      setBusy(false);
      return setError(data.error ?? 'Could not create the owner account.');
    }
    window.location.replace('/');
  }

  return (
    <AuthShell
      eyebrow="ONE-TIME SETUP"
      title="Create the first owner"
      subtitle="Secure the existing household data with its first owner account."
    >
      {status && !status.required ? (
        <div className="auth-state">
          <LockKeyhole size={28} />
          <p>Owner setup is complete.</p>
          <Link className="primary-button" href="/login">
            Go to sign in
          </Link>
        </div>
      ) : status && !status.configured ? (
        <div className="auth-state">
          <LockKeyhole size={28} />
          <p>
            Add the encrypted <code>BOOTSTRAP_TOKEN</code> secret to this
            Worker, then reload this page.
          </p>
        </div>
      ) : (
        <form className="auth-form" onSubmit={submit}>
          <label>
            Display name
            <input autoComplete="name" name="displayName" required />
          </label>
          <label>
            Email
            <input autoComplete="email" name="email" required type="email" />
          </label>
          <label>
            Password
            <input
              autoComplete="new-password"
              minLength={12}
              name="password"
              required
              type="password"
            />
          </label>
          <label>
            Bootstrap token
            <input
              autoComplete="off"
              name="bootstrapToken"
              required
              type="password"
            />
          </label>
          <p className="field-hint">
            Password must be at least 12 characters. Setup closes permanently
            after this owner is created.
          </p>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button
            className="primary-button auth-submit"
            disabled={busy || !status}
            type="submit"
          >
            {busy ? 'Creating owner…' : 'Create owner'}{' '}
            <UserRoundPlus size={17} />
          </button>
        </form>
      )}
    </AuthShell>
  );
}

export function InvitationScreen({ token }: { token: string }) {
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function accept(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const response = await fetch('/api/invitations/accept', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, email, displayName, password }),
    });
    const data = (await response.json()) as {
      error?: string;
      requiresLogin?: boolean;
    };
    if (!response.ok) {
      setBusy(false);
      if (data.requiresLogin)
        return setError(
          `${data.error} Sign in first, then open this invitation link again.`,
        );
      return setError(data.error ?? 'Could not accept this invitation.');
    }
    window.location.replace('/');
  }

  return (
    <AuthShell
      eyebrow="HOUSEHOLD INVITATION"
      title="Join a Homely household"
      subtitle="Use the exact email address that received this private invitation."
    >
      <form className="auth-form" onSubmit={accept}>
        <label>
          Email
          <input
            autoComplete="email"
            onChange={(event) => setEmail(event.target.value)}
            required
            type="email"
            value={email}
          />
        </label>
        <label>
          Your name <span>(new accounts)</span>
          <input
            autoComplete="name"
            onChange={(event) => setDisplayName(event.target.value)}
            value={displayName}
          />
        </label>
        <label>
          Create password <span>(new accounts)</span>
          <input
            autoComplete="new-password"
            minLength={12}
            onChange={(event) => setPassword(event.target.value)}
            type="password"
            value={password}
          />
        </label>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button
          className="primary-button auth-submit"
          disabled={busy}
          type="submit"
        >
          {busy ? 'Joining…' : 'Accept invitation'} <ArrowRight size={17} />
        </button>
      </form>
      <p className="auth-footnote">
        Already have an account?{' '}
        <Link
          href={`/login?returnTo=${encodeURIComponent(`/invite/${token}`)}`}
        >
          Sign in
        </Link>
        , then return here.
      </p>
    </AuthShell>
  );
}

function AuthShell({
  eyebrow,
  title,
  subtitle,
  children,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <main className="auth-page">
      <section className="auth-brand-panel">
        <Link className="auth-brand" href="/">
          <span className="brand-mark">
            <Home size={20} />
          </span>{' '}
          Homely
        </Link>
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>
        <p className="auth-security-note">
          <LockKeyhole size={16} /> Private by design. Your household data stays
          isolated.
        </p>
      </section>
      <section className="auth-card">{children}</section>
    </main>
  );
}
