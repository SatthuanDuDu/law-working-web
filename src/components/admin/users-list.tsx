"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Pencil, Search } from "lucide-react";
import { DeleteUserButton } from "@/components/admin/delete-user-button";
import { EditUserModal } from "@/components/admin/edit-user-modal";
import { ToggleUserActiveButton } from "@/components/admin/toggle-user-active-button";
import { ResetPasswordButton } from "@/components/admin/reset-password-button";
import { Badge, Card, CardContent, CardHeader, CardTitle, Select } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UserAvatar } from "@/components/ui/user-avatar";
import { useLabelMaps } from "@/i18n/use-label-maps";
import { cn, formatDate } from "@/lib/utils";
import type { Role } from "@prisma/client";

export type AdminUserListItem = {
  id: string;
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
  avatarKey: string | null;
  createdAt: string;
  department: { id: string; name: string } | null;
};

type StatusFilter = "all" | "active" | "inactive";

export function UsersList({
  users,
  currentUserId,
  departments,
}: {
  users: AdminUserListItem[];
  currentUserId: string;
  departments: { id: string; name: string }[];
}) {
  const t = useTranslations("admin");
  const tUsers = useTranslations("admin.users");
  const tSettings = useTranslations("settings");
  const tCommon = useTranslations("common");
  const tNav = useTranslations("nav");
  const locale = useLocale();
  const { roles } = useLabelMaps();

  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<Role | "all">("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [departmentFilter, setDepartmentFilter] = useState<string>("all");
  const [editUser, setEditUser] = useState<AdminUserListItem | null>(null);

  const departmentOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const user of users) {
      if (user.department) {
        map.set(user.department.id, user.department.name);
      }
    }
    return [...map.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, locale));
  }, [users, locale]);

  const visibleUsers = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return users.filter((user) => {
      if (roleFilter !== "all" && user.role !== roleFilter) return false;
      if (statusFilter === "active" && !user.isActive) return false;
      if (statusFilter === "inactive" && user.isActive) return false;
      if (departmentFilter !== "all") {
        if (departmentFilter === "none") {
          if (user.department) return false;
        } else if (user.department?.id !== departmentFilter) {
          return false;
        }
      }
      if (!normalized) return true;
      const haystack = [
        user.name,
        user.email,
        roles[user.role],
        user.department?.name ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(normalized);
    });
  }, [users, query, roleFilter, statusFilter, departmentFilter, roles]);

  return (
    <>
      <Card className="rounded-[5px]">
        <CardHeader className="gap-3 space-y-0 pb-3">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <CardTitle className="text-base sm:text-lg">{tNav("users")}</CardTitle>
            <p className="text-xs text-muted-foreground sm:text-sm">
              {visibleUsers.length === users.length
                ? tUsers("staffCount", { count: users.length })
                : tUsers("staffCountFiltered", {
                    visible: visibleUsers.length,
                    total: users.length,
                  })}
            </p>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <div className="relative min-w-0 sm:col-span-2 lg:col-span-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={tUsers("searchPlaceholder")}
                className="h-9 pl-9"
                aria-label={tUsers("searchLabel")}
              />
            </div>
            <Select
              value={roleFilter}
              onChange={(event) =>
                setRoleFilter(event.target.value as Role | "all")
              }
              className="h-9"
              aria-label={tSettings("role")}
            >
              <option value="all">{tUsers("allRoles")}</option>
              {(Object.keys(roles) as Role[]).map((role) => (
                <option key={role} value={role}>
                  {roles[role]}
                </option>
              ))}
            </Select>
            <Select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value as StatusFilter)
              }
              className="h-9"
              aria-label={tCommon("status")}
            >
              <option value="all">{tUsers("allStatuses")}</option>
              <option value="active">{t("active")}</option>
              <option value="inactive">{t("inactive")}</option>
            </Select>
            <Select
              value={departmentFilter}
              onChange={(event) => setDepartmentFilter(event.target.value)}
              className="h-9"
              aria-label={tSettings("department")}
            >
              <option value="all">{tUsers("allDepartments")}</option>
              <option value="none">{tUsers("noDepartment")}</option>
              {departmentOptions.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </Select>
          </div>
        </CardHeader>

        <CardContent className="divide-y divide-border/70 p-0">
          {users.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground sm:px-6">
              {tUsers("emptyHint")}
            </p>
          ) : visibleUsers.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground sm:px-6">
              {tUsers("noFilterMatch")}
            </p>
          ) : (
            visibleUsers.map((item) => {
              const meta = [
                item.department?.name,
                formatDate(item.createdAt),
              ]
                .filter(Boolean)
                .join(" · ");

              return (
                <div
                  key={item.id}
                  className={cn(
                    "px-4 py-3 sm:px-6",
                    !item.isActive && "bg-muted/30",
                  )}
                >
                  <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:gap-4">
                    <div className="flex min-w-0 flex-1 items-start gap-2.5 sm:items-center">
                      <UserAvatar
                        userId={item.id}
                        name={item.name}
                        avatarKey={item.avatarKey}
                        size="sm"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <h3 className="truncate text-sm font-semibold text-foreground">
                            {item.name}
                          </h3>
                          <Badge
                            variant={item.isActive ? "success" : "danger"}
                            className="px-2 py-0 text-[10px]"
                          >
                            {item.isActive ? t("active") : t("inactive")}
                          </Badge>
                          <span className="rounded-full bg-primary-muted px-2 py-0 text-[10px] font-semibold text-primary">
                            {roles[item.role]}
                          </span>
                        </div>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {item.email}
                          {meta ? ` · ${meta}` : ""}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col gap-1.5 sm:shrink-0 sm:items-end">
                      <div className="flex flex-wrap items-center gap-1.5 sm:justify-end">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setEditUser(item)}
                          className="h-8 px-2.5"
                          aria-label={tUsers("editUser")}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          <span className="hidden sm:inline">{tCommon("edit")}</span>
                        </Button>
                        <ResetPasswordButton
                          userId={item.id}
                          userName={item.name}
                          compact
                        />
                        <ToggleUserActiveButton
                          userId={item.id}
                          userName={item.name}
                          isActive={item.isActive}
                          disabled={item.id === currentUserId}
                          compact
                        />
                        <DeleteUserButton
                          userId={item.id}
                          userName={item.name}
                          canDelete={item.id !== currentUserId}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {editUser ? (
        <EditUserModal
          open={Boolean(editUser)}
          user={editUser}
          departments={departments}
          onClose={() => setEditUser(null)}
        />
      ) : null}
    </>
  );
}
