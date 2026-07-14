import type { Role } from "@prisma/client";

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
};

export function isAdmin(role: Role) {
  return role === "ADMIN";
}

export function isManagerOrAbove(role: Role) {
  return role === "ADMIN" || role === "MANAGER";
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

export function canViewAllDailyLogs(role: Role) {
  return role === "ADMIN" || role === "MANAGER";
}

export function canViewReports(role: Role) {
  return role === "ADMIN" || role === "MANAGER" || role === "LAWYER";
}

export function canAccessAdmin(role: Role) {
  return role === "ADMIN";
}
