"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Pencil, Plus, Search } from "lucide-react";
import { CreateUserModal } from "@/components/admin/create-user-modal";
import { DeleteUserButton } from "@/components/admin/delete-user-button";
import { EditUserModal } from "@/components/admin/edit-user-modal";
import { ToggleUserActiveButton } from "@/components/admin/toggle-user-active-button";
import { ResetPasswordButton } from "@/components/admin/reset-password-button";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FilterSelect } from "@/components/ui/filter-select";
import { ListViewToggle } from "@/components/ui/list-view-toggle";
import { UserAvatar } from "@/components/ui/user-avatar";
import { useListViewMode } from "@/hooks/use-list-view-mode";
import { useLabelMaps } from "@/i18n/use-label-maps";
import { cn, formatDate } from "@/lib/utils";
import type { Gender, Role } from "@prisma/client";

export type AdminUserListItem = {
  id: string;
  name: string;
  username: string;
  email: string;
  phone: string | null;
  dateOfBirth: string | null;
  gender: Gender | null;
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
  const { roles, gender: genders } = useLabelMaps();
  const { mode, setMode } = useListViewMode("users");

  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<Role | "all">("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [departmentFilter, setDepartmentFilter] = useState<string>("all");
  const [editUser, setEditUser] = useState<AdminUserListItem | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

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
        user.username,
        user.email,
        user.phone ?? "",
        user.gender ? genders[user.gender] : "",
        roles[user.role],
        user.department?.name ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(normalized);
    });
  }, [users, query, roleFilter, statusFilter, departmentFilter, roles, genders]);

  function UserActions({
    item,
    layout = "list",
  }: {
    item: AdminUserListItem;
    layout?: "list" | "grid";
  }) {
    const isGrid = layout === "grid";

    return (
      <div
        className={cn(
          "relative grid w-full shrink-0 justify-end gap-1.5 self-start",
          isGrid
            ? "grid-cols-3"
            : "grid-cols-[2rem_2rem_2rem_2rem] sm:w-[22rem] sm:grid-cols-[4.75rem_7.5rem_4.75rem_2rem]",
        )}
        role="group"
        aria-label={tUsers("editUser")}
      >
        <div className="min-w-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setEditUser(item)}
            className="h-8 w-full gap-1.5 px-0 sm:px-2"
            aria-label={tUsers("editUser")}
          >
            <Pencil className="h-3.5 w-3.5 shrink-0" />
            <span className="hidden truncate sm:inline">{tCommon("edit")}</span>
          </Button>
        </div>
        <div className="relative min-w-0">
          <ResetPasswordButton userId={item.id} userName={item.name} compact />
        </div>
        <div className="min-w-0">
          <ToggleUserActiveButton
            userId={item.id}
            userName={item.name}
            isActive={item.isActive}
            disabled={item.id === currentUserId}
            compact
          />
        </div>
        {isGrid ? null : (
          <div className="flex min-w-0 justify-center">
            <DeleteUserButton
              userId={item.id}
              userName={item.name}
              canDelete={item.id !== currentUserId}
            />
          </div>
        )}
      </div>
    );
  }

  function userMeta(item: AdminUserListItem) {
    return [
      item.phone,
      item.gender ? genders[item.gender] : null,
      item.dateOfBirth ? formatDate(item.dateOfBirth, locale) : null,
      item.department?.name,
    ]
      .filter(Boolean)
      .join(" · ");
  }

  return (
    <>
      <Card className="rounded-md">
        <CardHeader className="gap-3 space-y-0 border-b border-border/60 p-3.5 pb-3 sm:p-4 sm:pb-3">
          <CardTitle className="text-sm font-semibold sm:text-base">
            {tNav("users")}
          </CardTitle>

          <div className="flex items-end gap-2">
            <div className="grid min-w-0 flex-1 grid-cols-2 gap-2 lg:grid-cols-4">
              <div className="relative col-span-2 min-w-0 lg:col-span-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={tUsers("searchPlaceholder")}
                  className="h-10 pl-9"
                  aria-label={tUsers("searchLabel")}
                />
              </div>
              <FilterSelect
                value={roleFilter}
                onChange={(next) => setRoleFilter(next as Role | "all")}
                className="min-w-0"
                aria-label={tSettings("role")}
                options={[
                  { value: "all", label: tUsers("allRoles") },
                  ...(Object.keys(roles) as Role[]).map((role) => ({
                    value: role,
                    label: roles[role],
                  })),
                ]}
              />
              <FilterSelect
                value={statusFilter}
                onChange={(next) => setStatusFilter(next as StatusFilter)}
                className="min-w-0"
                aria-label={tCommon("status")}
                options={[
                  { value: "all", label: tUsers("allStatuses") },
                  { value: "active", label: t("active") },
                  { value: "inactive", label: t("inactive") },
                ]}
              />
              <FilterSelect
                value={departmentFilter}
                onChange={setDepartmentFilter}
                className="col-span-2 min-w-0 sm:col-span-1"
                aria-label={tSettings("department")}
                options={[
                  { value: "all", label: tUsers("allDepartments") },
                  { value: "none", label: tUsers("noDepartment") },
                  ...departmentOptions.map((department) => ({
                    value: department.id,
                    label: department.name,
                  })),
                ]}
              />
            </div>
            <Button
              type="button"
              size="icon"
              className="h-10 w-10 shrink-0 rounded-md p-0 [&_svg]:h-4 [&_svg]:w-4"
              onClick={() => setCreateOpen(true)}
              aria-label={t("createUser")}
              title={t("createUser")}
            >
              <Plus />
            </Button>
          </div>
        </CardHeader>

        <div className="flex justify-end px-3.5 pt-2.5 sm:px-4 sm:pt-3">
          <ListViewToggle mode={mode} onChange={setMode} size="sm" showTable={false} />
        </div>

        {users.length === 0 ? (
          <CardContent className="p-0">
            <p className="px-3.5 py-8 text-center text-sm text-muted-foreground sm:px-4">
              {tUsers("emptyHint")}
            </p>
          </CardContent>
        ) : visibleUsers.length === 0 ? (
          <CardContent className="p-0">
            <p className="px-3.5 py-8 text-center text-sm text-muted-foreground sm:px-4">
              {tUsers("noFilterMatch")}
            </p>
          </CardContent>
        ) : mode === "grid" ? (
          <CardContent className="grid grid-cols-1 gap-2.5 px-3.5 pb-3.5 pt-2.5 sm:grid-cols-2 sm:gap-3 sm:px-4 sm:pb-4 lg:grid-cols-3 2xl:grid-cols-4">
            {visibleUsers.map((item) => {
              const meta = userMeta(item);
              return (
                <div
                  key={item.id}
                  className={cn(
                    "relative flex h-full min-w-0 flex-col gap-2.5 rounded-md border border-border/40 bg-[color-mix(in_oklab,var(--muted)_6%,var(--surface))] p-3",
                    !item.isActive && "opacity-80",
                  )}
                >
                  <div className="absolute top-1.5 right-1.5 z-10">
                    <DeleteUserButton
                      userId={item.id}
                      userName={item.name}
                      canDelete={item.id !== currentUserId}
                    />
                  </div>
                  <div className="flex min-w-0 items-start gap-2.5 pr-8">
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
                        @{item.username}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">{item.email}</p>
                      {meta ? (
                        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                          {meta}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <div className="mt-auto">
                    <UserActions item={item} layout="grid" />
                  </div>
                </div>
              );
            })}
          </CardContent>
        ) : (
          <CardContent className="divide-y divide-border/60 p-0">
            {visibleUsers.map((item) => {
              const meta = userMeta(item);
              return (
                <div
                  key={item.id}
                  className={cn(
                    "px-3.5 py-3 sm:px-4",
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
                          @{item.username}
                          {` · ${item.email}`}
                          {meta ? ` · ${meta}` : ""}
                        </p>
                      </div>
                    </div>
                    <UserActions item={item} />
                  </div>
                </div>
              );
            })}
          </CardContent>
        )}
      </Card>

      {editUser ? (
        <EditUserModal
          open={Boolean(editUser)}
          user={editUser}
          departments={departments}
          onClose={() => setEditUser(null)}
        />
      ) : null}

      <CreateUserModal
        open={createOpen}
        departments={departments}
        onClose={() => setCreateOpen(false)}
      />
    </>
  );
}
