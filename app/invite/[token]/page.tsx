import { InvitationScreen } from '@/components/auth-screen';

export default async function InvitationPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <InvitationScreen token={token} />;
}
