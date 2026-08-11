import type { Role } from "@prisma/client";

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
  avatarKey?: string | null;
};

/** Higher number = higher authority. */
export function roleRank(role: Role): number {
  switch (role) {
    case "ADMIN":
      return 4;
    case "MANAGER":
      return 3;
    case "LAWYER":
      return 2;
    case "SUPPORT":
      return 1;
    default:
      return 0;
  }
}

export function isAdmin(role: Role) {
  return role === "ADMIN";
}

export function isManagerOrAbove(role: Role) {
  return role === "ADMIN" || role === "MANAGER";
}

/**
 * Actor may view/manage another user's wallet spend & confirmations
 * when target rank <= actor rank. Self always allowed.
 * Peer lawyers (same rank, different user) cannot manage each other.
 */
export function canManageWalletUser(
  actor: { id: string; role: Role },
  target: { id: string; role: Role },
): boolean {
  if (actor.id === target.id) return true;
  if (!isManagerOrAbove(actor.role)) return false;
  return roleRank(target.role) <= roleRank(actor.role);
}

/** Assignee for client cash handoff must be same or higher rank than creator. */
export function canAssignClientReceiptTo(
  actorRole: Role,
  assigneeRole: Role,
): boolean {
  return roleRank(assigneeRole) >= roleRank(actorRole);
}

/** Lawyer-level and above — can upload/replace/delete matter documents. */
export function canManageMatterDocuments(role: Role) {
  return role === "ADMIN" || role === "MANAGER" || role === "LAWYER";
}

export function canManageUsers(role: Role) {
  return role === "ADMIN";
}

export function canViewAllMatters(role: Role) {
  return role === "ADMIN" || role === "MANAGER";
}

export function canViewAllClients(role: Role) {
  return role === "ADMIN" || role === "MANAGER";
}

export function canAccessAdmin(role: Role) {
  return role === "ADMIN";
}
