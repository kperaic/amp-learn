import type { Result } from "./admin-types";

type Account = { id: string; role: string | null };
type InvitationSteps = {
  lookup: () => Promise<Result<Account | null>>;
  invite: () => Promise<Result<string>>;
  provision: (id: string) => Promise<Result>;
};

// The Auth identity survives a provisioning failure. Retrying resolves it first,
// then atomically repairs the profile and adds only the selected access.
export async function provisionInvitation(
  steps: InvitationSteps,
): Promise<Result<{ id: string; existing: boolean }>> {
  const lookup = await steps.lookup();
  if (lookup.error !== undefined) return { error: lookup.error };
  if (lookup.data?.role && lookup.data.role !== "student")
    return { error: "invalidAccount" };
  let id = lookup.data?.id;
  if (!id) {
    const invite = await steps.invite();
    if (invite.error !== undefined) return { error: invite.error };
    id = invite.data;
  }
  const provision = await steps.provision(id);
  if (provision.error !== undefined) return { error: "provisionFailed" };
  return { data: { id, existing: !!lookup.data } };
}
