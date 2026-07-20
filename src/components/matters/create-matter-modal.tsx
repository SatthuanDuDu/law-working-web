"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition, type FormEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import type { MatterType } from "@prisma/client";
import { X, ChevronDown, Plus, Users, Scale } from "lucide-react";
import { createMatterAction, updateMatterAction } from "@/lib/actions";
import { buildMatterCode } from "@/lib/matter-code";
import type { MatterFormData } from "@/lib/matter-form-data";
import {
  VIETNAM_CITY_SUGGESTIONS,
} from "@/lib/constants";
import { useTranslations } from "next-intl";
import { useLabelMaps } from "@/i18n/use-label-maps";
import { invalidateMatterFormDataCache } from "@/hooks/use-matter-form-data";
import { useConfirmDialog } from "@/hooks/use-confirm-dialog";
import { useOverlayAnimation } from "@/hooks/use-overlay-animation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label, Select } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const matterTypeControlClass =
  "interactive-field h-full w-full appearance-none rounded-[5px] border-0 bg-surface pl-5 pr-12 text-base font-bold text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40";

const matterTypeChevronClass =
  "absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground";

const outlinedFieldLabelClass =
  "pointer-events-none absolute left-3 top-0 z-[1] -translate-y-1/2 bg-surface px-1.5 text-sm font-medium text-foreground";

const outlinedFieldInputClass =
  "interactive-field w-full rounded-[5px] border border-border bg-surface px-3 pb-2.5 pt-3";

function OutlinedField({
  label,
  htmlFor,
  children,
  className,
}: {
  label: string;
  htmlFor: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      {children}
      <Label htmlFor={htmlFor} className={outlinedFieldLabelClass}>
        {label}
      </Label>
    </div>
  );
}

function normalizeSearchText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .trim();
}

function filterCitySuggestions(query: string) {
  const normalizedQuery = normalizeSearchText(query);

  if (!normalizedQuery) {
    return [...VIETNAM_CITY_SUGGESTIONS];
  }

  return VIETNAM_CITY_SUGGESTIONS.map((city, index) => {
    const normalizedCity = normalizeSearchText(city);
    let rank = -1;

    if (normalizedCity === normalizedQuery) rank = 0;
    else if (normalizedCity.startsWith(normalizedQuery)) rank = 1;
    else if (normalizedCity.includes(normalizedQuery)) rank = 2;

    return { city, rank, index };
  })
    .filter((item) => item.rank >= 0)
    .sort((a, b) => (a.rank !== b.rank ? a.rank - b.rank : a.index - b.index))
    .map((item) => item.city);
}

function CityAutocompleteInput({
  id,
  name,
  value,
  onChange,
  disabled,
  className,
  placeholder,
}: {
  id: string;
  name?: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(0);

  const suggestions = useMemo(() => filterCitySuggestions(value), [value]);

  useEffect(() => {
    setHighlightIndex(0);
  }, [value, suggestions.length]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  function selectSuggestion(city: string) {
    onChange(city);
    setOpen(false);
  }

  return (
    <div ref={containerRef} className="relative">
      <Input
        id={id}
        name={name}
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        autoComplete="off"
        aria-autocomplete="list"
        aria-expanded={open && suggestions.length > 0}
        aria-controls={`${id}-suggestions`}
        className={className}
        onChange={(event) => {
          onChange(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(event) => {
          if (!open || suggestions.length === 0) {
            if (event.key === "ArrowDown" && suggestions.length > 0) {
              event.preventDefault();
              setOpen(true);
            }
            return;
          }

          if (event.key === "ArrowDown") {
            event.preventDefault();
            setHighlightIndex((current) => (current + 1) % suggestions.length);
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setHighlightIndex(
              (current) => (current - 1 + suggestions.length) % suggestions.length,
            );
          } else if (event.key === "Enter") {
            event.preventDefault();
            const selected = suggestions[highlightIndex];
            if (selected) selectSuggestion(selected);
          } else if (event.key === "Escape") {
            setOpen(false);
          }
        }}
      />

      {open && suggestions.length > 0 ? (
        <ul
          id={`${id}-suggestions`}
          role="listbox"
          className="absolute left-0 right-0 top-full z-20 mt-1 max-h-48 overflow-y-auto rounded-[5px] border border-border bg-surface py-1 shadow-lg"
        >
          {suggestions.map((city, index) => (
            <li key={city} role="option" aria-selected={index === highlightIndex}>
              <button
                type="button"
                className={cn(
                  "interactive-press w-full px-3 py-2 text-left text-sm transition-colors",
                  index === highlightIndex
                    ? "bg-primary-muted font-medium text-primary"
                    : "text-foreground hover:bg-muted",
                )}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setHighlightIndex(index)}
                onClick={() => selectSuggestion(city)}
              >
                {city}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function AssociateMultiSelect({
  id,
  members,
  selectedIds,
  onChange,
  excludeIds = [],
}: {
  id: string;
  members: MatterFormData["members"];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  excludeIds?: string[];
}) {
  const t = useTranslations("matters.createModal");
  const { roles } = useLabelMaps();
  const availableMembers = members.filter(
    (member) => !selectedIds.includes(member.id) && !excludeIds.includes(member.id),
  );

  function addMember(memberId: string) {
    if (!memberId || selectedIds.includes(memberId)) return;
    onChange([...selectedIds, memberId]);
  }

  function removeMember(memberId: string) {
    onChange(selectedIds.filter((currentId) => currentId !== memberId));
  }

  return (
    <OutlinedField label={t("associates")} htmlFor={id}>
      <div
        className={cn(
          outlinedFieldInputClass,
          "flex min-h-10 flex-wrap items-center gap-1.5 px-2 py-1.5",
        )}
      >
        {selectedIds.map((memberId) => {
          const member = members.find((item) => item.id === memberId);
          if (!member) return null;

          return (
            <span
              key={memberId}
              className="inline-flex max-w-full items-center gap-1 rounded-[4px] bg-muted py-0.5 pl-2 pr-1 text-sm text-foreground"
            >
              <span className="truncate">
                {member.name} ({roles[member.role]})
              </span>
              <button
                type="button"
                onClick={() => removeMember(memberId)}
                className="interactive-press rounded p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label={t("removeMember", { name: member.name })}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          );
        })}
        <select
          id={id}
          value=""
          disabled={availableMembers.length === 0}
          onChange={(event) => {
            addMember(event.target.value);
          }}
          className={cn(
            "min-w-[8rem] flex-1 appearance-none border-0 bg-transparent py-0.5 pr-6 text-sm outline-none",
            availableMembers.length === 0
              ? "cursor-not-allowed text-muted-foreground"
              : "cursor-pointer text-foreground",
          )}
        >
          <option value="">
            {availableMembers.length === 0
              ? t("noAssociatesLeft")
              : selectedIds.length === 0
                ? t("selectAssociate")
                : t("addAssociate")}
          </option>
          {availableMembers.map((member) => (
            <option key={member.id} value={member.id}>
              {member.name} ({roles[member.role]})
            </option>
          ))}
        </select>
        <ChevronDown
          className="pointer-events-none -ml-5 h-4 w-4 shrink-0 text-muted-foreground"
          aria-hidden
        />
      </div>
    </OutlinedField>
  );
}

function CreateMatterSummaryTable({
  rows,
}: {
  rows: { label: string; value: string }[];
}) {
  return (
    <div className="mt-3 max-h-[min(50vh,420px)] overflow-y-auto rounded-[5px] border border-border">
      <table className="w-full text-sm">
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className="border-b border-border/60 last:border-0">
              <th
                scope="row"
                className="w-[38%] bg-muted/50 px-3 py-2.5 text-left align-top font-medium text-muted-foreground"
              >
                {row.label}
              </th>
              <td className="break-words px-3 py-2.5 text-foreground whitespace-pre-wrap">
                {row.value || "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function parseClientPhones(phone: string | null | undefined) {
  return phone?.split(/[,;|/]/).map((item) => item.trim()).filter(Boolean) ?? [];
}

function getDefaultLeadLawyerId(formData: MatterFormData) {
  if (
    formData.currentUser.role !== "ADMIN" &&
    formData.currentUser.role !== "MANAGER" &&
    formData.lawyers.some((lawyer) => lawyer.id === formData.currentUser.id)
  ) {
    return formData.currentUser.id;
  }

  return (
    formData.lawyers.find((lawyer) => lawyer.id === formData.currentUser.id)?.id ??
    formData.lawyers[0]?.id ??
    formData.currentUser.id
  );
}

export type MatterEditInitial = {
  id: string;
  code: string;
  title: string;
  description: string | null;
  type: MatterType;
  customTypeLabel: string | null;
  clientId: string;
  clientName: string;
  clientPhone: string | null;
  clientAddress: string | null;
  clientCity: string | null;
  leadLawyerId: string;
  memberIds: string[];
};

export function CreateMatterModal({
  open,
  formData,
  onClose,
  editMatter = null,
}: {
  open: boolean;
  formData: MatterFormData;
  onClose: () => void;
  editMatter?: MatterEditInitial | null;
}) {
  const isEdit = Boolean(editMatter);
  const t = useTranslations("matters.createModal");
  const tMatters = useTranslations("matters");
  const tClients = useTranslations("clients");
  const tCommon = useTranslations("common");
  const { roles, matterType } = useLabelMaps();
  const router = useRouter();
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const { confirm, dialog } = useConfirmDialog();
  const { mounted, active } = useOverlayAnimation(open);

  const [type, setType] = useState<MatterType>("CIVIL");
  const [customTypeLabel, setCustomTypeLabel] = useState("");
  const [customTypeInputOpen, setCustomTypeInputOpen] = useState(false);
  const [clientMode, setClientMode] = useState<"existing" | "new">("existing");
  const [selectedClientId, setSelectedClientId] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientPhones, setClientPhones] = useState<string[]>([]);
  const [phoneDraft, setPhoneDraft] = useState("");
  const phoneInputRef = useRef<HTMLInputElement>(null);
  const [clientAddress, setClientAddress] = useState("");
  const [clientCity, setClientCity] = useState("");
  const [leadLawyerId, setLeadLawyerId] = useState(() => getDefaultLeadLawyerId(formData));
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [formKey, setFormKey] = useState(0);
  const typeSelectRef = useRef<HTMLSelectElement>(null);
  const [newClientOpen, setNewClientOpen] = useState(false);
  const { mounted: newClientMounted, active: newClientActive } =
    useOverlayAnimation(newClientOpen);
  const [draftClientName, setDraftClientName] = useState("");
  const [draftClientPhones, setDraftClientPhones] = useState<string[]>([]);
  const [draftPhoneDraft, setDraftPhoneDraft] = useState("");
  const [draftClientAddress, setDraftClientAddress] = useState("");
  const [draftClientCity, setDraftClientCity] = useState("");
  const [draftClientError, setDraftClientError] = useState("");
  const draftPhoneInputRef = useRef<HTMLInputElement>(null);

  const applyEditMatter = useCallback((matter: MatterEditInitial) => {
    setType(matter.type);
    setCustomTypeLabel(matter.customTypeLabel ?? "");
    setCustomTypeInputOpen(matter.type === "OTHER");
    setClientMode("existing");
    setSelectedClientId(matter.clientId);
    setClientName("");
    setClientPhones(parseClientPhones(matter.clientPhone));
    setPhoneDraft("");
    setClientAddress(matter.clientAddress ?? "");
    setClientCity(matter.clientCity ?? "");
    setLeadLawyerId(matter.leadLawyerId);
    setSelectedMembers(matter.memberIds.filter((id) => id !== matter.leadLawyerId));
    setNewClientOpen(false);
    setFormKey((key) => key + 1);
  }, []);

  const resetCreateFields = useCallback(() => {
    setClientMode("existing");
    setSelectedClientId("");
    setClientName("");
    setClientPhones([]);
    setPhoneDraft("");
    setClientAddress("");
    setClientCity("");
    setSelectedMembers([]);
    setCustomTypeLabel("");
    setCustomTypeInputOpen(false);
    setType("CIVIL");
    setLeadLawyerId(getDefaultLeadLawyerId(formData));
    setNewClientOpen(false);
    setFormKey((key) => key + 1);
  }, [formData]);

  useEffect(() => {
    if (!open) return;
    setError("");
    if (editMatter) {
      applyEditMatter(editMatter);
    } else {
      resetCreateFields();
    }
  }, [open, editMatter, applyEditMatter, resetCreateFields]);

  useEffect(() => {
    setSelectedMembers((current) => current.filter((id) => id !== leadLawyerId));
  }, [leadLawyerId]);

  const handleOpenTypeList = useCallback(() => {
    if (type === "OTHER" && customTypeInputOpen) {
      setCustomTypeInputOpen(false);
    }

    const select = typeSelectRef.current;
    if (!select) return;

    select.focus();
    try {
      select.showPicker();
    } catch {
      select.click();
    }
  }, [type, customTypeInputOpen]);

  const canPickLeadLawyer =
    formData.currentUser.role === "ADMIN" ||
    formData.currentUser.role === "MANAGER" ||
    !formData.lawyers.some((lawyer) => lawyer.id === formData.currentUser.id);

  const previewCode = useMemo(() => {
    if (editMatter) return editMatter.code;
    return buildMatterCode(type, customTypeLabel, formData.todayMatterCount + 1);
  }, [editMatter, type, customTypeLabel, formData.todayMatterCount]);

  const handleClose = useCallback(() => {
    setError("");
    setNewClientOpen(false);
    resetCreateFields();
    onClose();
  }, [onClose, resetCreateFields]);

  const closeNewClientModal = useCallback(() => {
    setNewClientOpen(false);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (newClientOpen) {
        event.stopPropagation();
        closeNewClientModal();
        return;
      }
      handleClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [mounted, handleClose, newClientOpen, closeNewClientModal]);

  if (!mounted || typeof document === "undefined") return null;

  function handleClientChange(clientId: string) {
    setClientMode("existing");
    setSelectedClientId(clientId);
    setClientName("");
    const client = formData.clients.find((item) => item.id === clientId);
    if (!client) {
      setClientPhones([]);
      setPhoneDraft("");
      setClientAddress("");
      setClientCity("");
      return;
    }

    setClientPhones(parseClientPhones(client.phone));
    setPhoneDraft("");
    setClientAddress(client.address ?? "");
    setClientCity(client.city ?? "");
  }

  function openNewClientModal() {
    setDraftClientName(clientMode === "new" ? clientName : "");
    setDraftClientPhones(clientMode === "new" ? clientPhones : []);
    setDraftPhoneDraft("");
    setDraftClientAddress(clientMode === "new" ? clientAddress : "");
    setDraftClientCity(clientMode === "new" ? clientCity : "");
    setDraftClientError("");
    setNewClientOpen(true);
  }

  function confirmNewClient() {
    const name = draftClientName.trim();
    if (!name) {
      setDraftClientError(t("newClientNameRequired"));
      return;
    }

    const phones = [
      ...draftClientPhones.map((phone) => phone.trim()).filter(Boolean),
      ...(draftPhoneDraft.trim() ? [draftPhoneDraft.trim()] : []),
    ];

    setDraftClientError("");
    setError("");
    setClientMode("new");
    setSelectedClientId("");
    setClientName(name);
    setClientPhones(phones);
    setPhoneDraft("");
    setClientAddress(draftClientAddress.trim());
    setClientCity(draftClientCity.trim());
    setNewClientOpen(false);
  }

  function clearNewClient() {
    setClientMode("existing");
    setClientName("");
    setSelectedClientId("");
    setClientPhones([]);
    setPhoneDraft("");
    setClientAddress("");
    setClientCity("");
  }

  function commitPhoneDraft() {
    const trimmed = phoneDraft.trim();
    if (!trimmed) {
      phoneInputRef.current?.focus();
      return;
    }

    setClientPhones((current) =>
      current.includes(trimmed) ? current : [...current, trimmed],
    );
    setPhoneDraft("");
    phoneInputRef.current?.focus();
  }

  function removeClientPhone(index: number) {
    setClientPhones((current) => current.filter((_, i) => i !== index));
    phoneInputRef.current?.focus();
  }

  function commitDraftPhone() {
    const trimmed = draftPhoneDraft.trim();
    if (!trimmed) {
      draftPhoneInputRef.current?.focus();
      return;
    }

    setDraftClientPhones((current) =>
      current.includes(trimmed) ? current : [...current, trimmed],
    );
    setDraftPhoneDraft("");
    draftPhoneInputRef.current?.focus();
  }

  function removeDraftPhone(index: number) {
    setDraftClientPhones((current) => current.filter((_, i) => i !== index));
    draftPhoneInputRef.current?.focus();
  }

  const clientFieldsDisabled = clientMode === "existing" && !selectedClientId;

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formDataPayload = new FormData(e.currentTarget);
    const title = String(formDataPayload.get("title") ?? "").trim();
    const description = String(formDataPayload.get("description") ?? "").trim();
    const clientName = String(formDataPayload.get("clientName") ?? "").trim();
    const phones = [
      ...clientPhones.map((phone) => phone.trim()).filter(Boolean),
      ...(phoneDraft.trim() ? [phoneDraft.trim()] : []),
    ];
    const typeLabel =
      type === "OTHER" && customTypeLabel.trim()
        ? customTypeLabel.trim()
        : matterType[type];
    const selectedClient = formData.clients.find((client) => client.id === selectedClientId);
    const leadLawyer =
      formData.lawyers.find((lawyer) => lawyer.id === leadLawyerId) ?? formData.currentUser;
    const associates = selectedMembers
      .map((memberId) => formData.members.find((member) => member.id === memberId))
      .filter((member): member is MatterFormData["members"][number] => Boolean(member));

    const summaryRows = [
      { label: t("matterCode"), value: previewCode },
      { label: t("matterName"), value: title },
      { label: tMatters("fieldDescription"), value: description },
      { label: t("matterType"), value: typeLabel },
      {
        label: t("clientType"),
        value: clientMode === "new" ? t("newClient") : t("existingClient"),
      },
      {
        label: tClients("name"),
        value: clientMode === "existing" ? (selectedClient?.name ?? "") : clientName,
      },
      { label: t("clientPhone"), value: phones.join(", ") },
      { label: t("city"), value: clientCity.trim() },
      { label: t("clientAddress"), value: clientAddress.trim() },
      {
        label: t("leadLawyerMain"),
        value: `${leadLawyer.name} (${roles[leadLawyer.role]})`,
      },
      {
        label: t("associates"),
        value:
          associates.length > 0
            ? associates.map((member) => `${member.name} (${roles[member.role]})`).join("\n")
            : "",
      },
    ];

    confirm({
      title: isEdit ? t("confirmUpdateTitle") : t("confirmCreateTitle"),
      message: isEdit ? t("reviewBeforeSave") : t("reviewBeforeCreate"),
      content: <CreateMatterSummaryTable rows={summaryRows} />,
      confirmLabel: isEdit ? t("confirmSave") : t("confirmCreate"),
      cancelLabel: tCommon("back"),
      size: "large",
      onConfirm: () => {
        setError("");
        formDataPayload.delete("clientPhone");
        phones.forEach((phone) => formDataPayload.append("clientPhones", phone));
        selectedMembers.forEach((id) => formDataPayload.append("memberIds", id));

        startTransition(async () => {
          const result = isEdit && editMatter
            ? await updateMatterAction(editMatter.id, formDataPayload)
            : await createMatterAction(formDataPayload);
          if (result.error) {
            setError(result.error);
            return;
          }
          handleClose();
          invalidateMatterFormDataCache();
          if (!isEdit && "matterId" in result && result.matterId) {
            router.push(`/matters/${result.matterId}`);
          }
          router.refresh();
        });
      },
    });
  }

  return createPortal(
    <>
      {dialog}
      <div className="fixed inset-0 z-[9998] flex h-dvh w-dvw items-stretch justify-center p-0 sm:items-center sm:p-6">
        <button
          type="button"
          aria-label={t("closeFormAria")}
          className={cn(
            "overlay-backdrop absolute inset-0 bg-black/40 backdrop-blur-[1px]",
            active && "is-active",
          )}
          onClick={() => {
            if (newClientOpen) return;
            handleClose();
          }}
        />
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-matter-title"
          className={cn(
            "overlay-panel relative z-10 flex h-dvh max-h-none w-full max-w-none flex-col overflow-hidden rounded-none border-0 bg-surface shadow-[var(--shadow-overlay)] sm:h-auto sm:max-h-[min(90dvh,900px)] sm:max-w-2xl sm:rounded-lg sm:border sm:border-border",
            active && "is-active",
          )}
        >
          <div className="flex items-start justify-between border-b border-border px-6 py-4">
            <div>
              <h2 id="create-matter-title" className="text-xl font-semibold text-primary">
                {isEdit ? tMatters("editMatter") : t("createTitle")}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {isEdit ? t("editSubtitle") : t("createSubtitle")}
              </p>
            </div>
            <Button type="button" variant="ghost" size="icon" onClick={handleClose} aria-label={tCommon("close")}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="overflow-y-auto px-6 py-6 sm:px-8 sm:py-7">
            <form
              id="create-matter-form"
              key={formKey}
              onSubmit={handleSubmit}
              className="space-y-8"
            >
              <input type="hidden" name="clientMode" value={clientMode} />
              <input type="hidden" name="leadLawyerId" value={leadLawyerId} />

              <div className="grid w-full grid-cols-1 gap-4 rounded-[5px] bg-primary px-4 py-4 shadow-md md:grid-cols-2 md:items-center md:gap-6">
                <div className="flex flex-col justify-center">
                  <p className="break-all font-mono text-2xl font-bold leading-tight tracking-tight text-white sm:text-3xl">
                    {previewCode}
                  </p>
                </div>

                <div className="flex flex-col justify-center space-y-3">
                  <Label
                    htmlFor={type === "OTHER" && customTypeInputOpen ? "customTypeLabel" : "type"}
                    className="text-base font-bold text-white"
                  >
                    {t("matterType")}
                  </Label>
                  <div className="relative h-12 w-full">
                    {type === "OTHER" && customTypeInputOpen ? (
                      <input type="hidden" name="type" value="OTHER" />
                    ) : null}
                    {type === "OTHER" && !customTypeInputOpen && customTypeLabel ? (
                      <input type="hidden" name="customTypeLabel" value={customTypeLabel} />
                    ) : null}

                    <Select
                      ref={typeSelectRef}
                      id="type"
                      name={type === "OTHER" && customTypeInputOpen ? undefined : "type"}
                      value={type}
                      tabIndex={type === "OTHER" && customTypeInputOpen ? -1 : 0}
                      aria-hidden={type === "OTHER" && customTypeInputOpen}
                      onChange={(e) => {
                        const nextType = e.target.value as MatterType;
                        if (nextType === "OTHER") {
                          setType("OTHER");
                          setCustomTypeInputOpen(true);
                          return;
                        }
                        setType(nextType);
                        setCustomTypeInputOpen(false);
                        setCustomTypeLabel("");
                      }}
                      className={cn(
                        matterTypeControlClass,
                        type === "OTHER" &&
                          customTypeInputOpen &&
                          "pointer-events-none absolute inset-0 invisible",
                      )}
                    >
                      {Object.entries(matterType).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </Select>

                    {type === "OTHER" && customTypeInputOpen ? (
                      <Input
                        id="customTypeLabel"
                        name="customTypeLabel"
                        value={customTypeLabel}
                        onChange={(e) => setCustomTypeLabel(e.target.value)}
                        placeholder={t("customTypePlaceholder")}
                        required
                        autoFocus
                        className={cn(matterTypeControlClass, "absolute inset-0 z-[1] font-semibold")}
                      />
                    ) : null}

                    <button
                      type="button"
                      onClick={handleOpenTypeList}
                      className={cn(
                        "interactive-press z-[2]",
                        matterTypeChevronClass,
                        "rounded p-0.5 hover:bg-muted hover:text-foreground",
                      )}
                      aria-label={t("openTypeListAria")}
                    >
                      <ChevronDown className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>

              <div className="relative">
                <Input
                  id="title"
                  name="title"
                  required
                  defaultValue={editMatter?.title ?? ""}
                  placeholder={t("titlePlaceholder")}
                  className={outlinedFieldInputClass}
                />
                <Label htmlFor="title" className={outlinedFieldLabelClass}>
                  {t("matterName")}
                </Label>
              </div>

              <div className="relative">
                <Textarea
                  id="description"
                  name="description"
                  rows={3}
                  defaultValue={editMatter?.description ?? ""}
                  placeholder={t("descriptionPlaceholder")}
                  className={cn(outlinedFieldInputClass, "min-h-[6.5rem] resize-y")}
                />
                <Label htmlFor="description" className={outlinedFieldLabelClass}>
                  {tMatters("fieldDescription")}
                </Label>
              </div>

              <div className="relative rounded-[5px] border border-border p-4">
                <div className="mb-6 flex flex-wrap items-center justify-between gap-2 text-sm font-semibold text-foreground">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                    {tMatters("client")}
                  </div>
                  {clientMode === "existing" ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={openNewClientModal}
                      className="interactive-press shrink-0"
                    >
                      <Plus className="h-4 w-4" />
                      {tClients("newClient")}
                    </Button>
                  ) : null}
                </div>

                <div className="space-y-7">
                  {clientMode === "new" ? (
                    <>
                      <input type="hidden" name="clientName" value={clientName} />
                      <input type="hidden" name="clientAddress" value={clientAddress} />
                      <input type="hidden" name="clientCity" value={clientCity} />
                      <div className="rounded-[5px] border border-primary/20 bg-primary-muted px-4 py-3">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0 space-y-1">
                            <p className="text-xs font-medium uppercase tracking-wide text-primary/70">
                              {tClients("newClient")}
                            </p>
                            <p className="break-words font-semibold text-foreground">
                              {clientName}
                            </p>
                            {clientPhones.length > 0 ? (
                              <p className="break-words text-sm text-muted-foreground">
                                {clientPhones.join(", ")}
                              </p>
                            ) : null}
                            {[clientAddress, clientCity].filter(Boolean).length > 0 ? (
                              <p className="break-words text-sm text-muted-foreground">
                                {[clientAddress, clientCity].filter(Boolean).join(", ")}
                              </p>
                            ) : null}
                          </div>
                          <div className="flex shrink-0 flex-wrap gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={openNewClientModal}
                            >
                              {tCommon("edit")}
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={clearNewClient}
                            >
                              {t("switchToExistingClient")}
                            </Button>
                          </div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                        <OutlinedField
                          label={t("selectClient")}
                          htmlFor="clientId"
                          className="min-w-0 flex-1"
                        >
                          <Select
                            id="clientId"
                            name="clientId"
                            value={selectedClientId}
                            onChange={(e) => handleClientChange(e.target.value)}
                            className={cn(outlinedFieldInputClass, "h-11")}
                          >
                            <option value="">{t("selectClientPlaceholder")}</option>
                            {formData.clients.map((client) => (
                              <option key={client.id} value={client.id}>
                                {client.name}
                              </option>
                            ))}
                          </Select>
                        </OutlinedField>
                      </div>

                      <div className="flex items-stretch gap-2">
                        <OutlinedField
                          label={t("clientPhone")}
                          htmlFor="clientPhone"
                          className="min-w-0 flex-1"
                        >
                          <div
                            className={cn(
                              outlinedFieldInputClass,
                              "client-phone-field flex min-h-10 flex-wrap items-center gap-1.5 px-2 focus-within:outline-none focus-within:ring-2 focus-within:ring-primary/40",
                            )}
                            onClick={() => phoneInputRef.current?.focus()}
                          >
                            {clientPhones.map((phone, index) => (
                              <span
                                key={`${phone}-${index}`}
                                className="client-phone-chip inline-flex max-w-full items-center gap-1 rounded-[4px] bg-muted py-0.5 pl-2 pr-1 text-sm text-foreground"
                              >
                                <span className="truncate">{phone}</span>
                                <button
                                  type="button"
                                  disabled={clientFieldsDisabled}
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    removeClientPhone(index);
                                  }}
                                  className="interactive-press rounded p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none"
                                  aria-label={t("removePhone", { phone })}
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </span>
                            ))}
                            <input
                              ref={phoneInputRef}
                              id="clientPhone"
                              type="tel"
                              value={phoneDraft}
                              disabled={clientFieldsDisabled}
                              onChange={(event) => setPhoneDraft(event.target.value)}
                              onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                  event.preventDefault();
                                  commitPhoneDraft();
                                }

                                if (
                                  event.key === "Backspace" &&
                                  phoneDraft === "" &&
                                  clientPhones.length > 0
                                ) {
                                  removeClientPhone(clientPhones.length - 1);
                                }
                              }}
                              placeholder={
                                clientPhones.length === 0 ? "0901234567" : t("addPhonePlaceholder")
                              }
                              className="min-w-[7rem] flex-1 border-0 bg-transparent px-1 py-0.5 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
                            />
                          </div>
                        </OutlinedField>
                        <Button
                          type="button"
                          variant="outline"
                          disabled={clientFieldsDisabled}
                          onClick={commitPhoneDraft}
                          className="interactive-press h-auto w-10 shrink-0 self-stretch rounded-[5px] p-0"
                          aria-label={t("addPhone")}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>

                      <OutlinedField label={t("city")} htmlFor="clientCity">
                        <CityAutocompleteInput
                          id="clientCity"
                          name="clientCity"
                          value={clientCity}
                          onChange={setClientCity}
                          placeholder={t("cityPlaceholder")}
                          disabled={clientFieldsDisabled}
                          className={outlinedFieldInputClass}
                        />
                      </OutlinedField>

                      <OutlinedField label={t("clientAddress")} htmlFor="clientAddress">
                        <Input
                          id="clientAddress"
                          name="clientAddress"
                          value={clientAddress}
                          onChange={(e) => setClientAddress(e.target.value)}
                          placeholder={t("addressPlaceholder")}
                          disabled={clientFieldsDisabled}
                          className={outlinedFieldInputClass}
                        />
                      </OutlinedField>
                    </>
                  )}
                </div>
              </div>

              <div className="relative rounded-[5px] border border-border px-4 pb-5 pt-8">
                <div className="absolute left-3 top-0 -translate-y-1/2">
                  <div className="flex items-center gap-2 rounded-[5px] bg-primary px-3 py-1.5 text-base font-semibold text-white shadow-sm">
                    <Scale className="h-4 w-4 shrink-0" aria-hidden />
                    {tMatters("leadLawyer")}
                  </div>
                </div>

                <div className="space-y-7">
                  {canPickLeadLawyer ? (
                    <OutlinedField label={t("leadLawyerMain")} htmlFor="leadLawyerDisplay">
                      <div className="relative">
                        <Select
                          id="leadLawyerDisplay"
                          value={leadLawyerId}
                          onChange={(event) => setLeadLawyerId(event.target.value)}
                          className={cn(outlinedFieldInputClass, "h-11 appearance-none pr-10")}
                        >
                          {formData.lawyers.map((lawyer) => (
                            <option key={lawyer.id} value={lawyer.id}>
                              {lawyer.name} ({roles[lawyer.role]})
                            </option>
                          ))}
                        </Select>
                        <ChevronDown
                          className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                          aria-hidden
                        />
                      </div>
                    </OutlinedField>
                  ) : (
                    <OutlinedField label={t("leadLawyerMain")} htmlFor="leadLawyerDisplay">
                      <Input
                        id="leadLawyerDisplay"
                        value={`${formData.currentUser.name} (${roles[formData.currentUser.role]})`}
                        readOnly
                        disabled
                        className={outlinedFieldInputClass}
                      />
                    </OutlinedField>
                  )}

                  <AssociateMultiSelect
                    id="associatePicker"
                    members={formData.members}
                    selectedIds={selectedMembers}
                    onChange={setSelectedMembers}
                    excludeIds={[leadLawyerId]}
                  />
                </div>
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}

              <div className="flex justify-end gap-3 border-t border-border pt-6">
                <Button type="button" variant="outline" onClick={handleClose}>
                  {tCommon("cancel")}
                </Button>
                <Button type="submit" disabled={isPending}>
                  {isPending
                    ? isEdit
                      ? tCommon("saving")
                      : t("creating")
                    : isEdit
                      ? t("saveChanges")
                      : tMatters("create")}
                </Button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {newClientMounted ? (
        <div className="fixed inset-0 z-[10000] flex h-dvh w-dvw items-stretch justify-center p-0 sm:items-center sm:p-6">
          <button
            type="button"
            aria-label={t("closeNewClientAria")}
            className={cn(
              "overlay-backdrop absolute inset-0 bg-black/45 backdrop-blur-[1px]",
              newClientActive && "is-active",
            )}
            onClick={closeNewClientModal}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-client-title"
            className={cn(
              "overlay-panel relative z-10 flex max-h-[min(90dvh,720px)] w-full max-w-lg flex-col overflow-hidden rounded-none border-0 bg-surface shadow-[var(--shadow-overlay)] sm:rounded-lg sm:border sm:border-border",
              newClientActive && "is-active",
            )}
          >
            <div className="flex items-start justify-between border-b border-border px-5 py-4 sm:px-6">
              <div>
                <h3 id="new-client-title" className="text-lg font-semibold text-primary">
                  {tClients("newClient")}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t("newClientSubtitle")}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={closeNewClientModal}
                aria-label={tCommon("close")}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-5 sm:px-6">
              <OutlinedField label={t("clientFullName")} htmlFor="draftClientName">
                <Input
                  id="draftClientName"
                  value={draftClientName}
                  onChange={(e) => setDraftClientName(e.target.value)}
                  placeholder={t("clientNamePlaceholder")}
                  autoFocus
                  className={outlinedFieldInputClass}
                />
              </OutlinedField>

              <div className="flex items-stretch gap-2">
                <OutlinedField
                  label={t("clientPhone")}
                  htmlFor="draftClientPhone"
                  className="min-w-0 flex-1"
                >
                  <div
                    className={cn(
                      outlinedFieldInputClass,
                      "client-phone-field flex min-h-10 flex-wrap items-center gap-1.5 px-2 focus-within:outline-none focus-within:ring-2 focus-within:ring-primary/40",
                    )}
                    onClick={() => draftPhoneInputRef.current?.focus()}
                  >
                    {draftClientPhones.map((phone, index) => (
                      <span
                        key={`${phone}-${index}`}
                        className="client-phone-chip inline-flex max-w-full items-center gap-1 rounded-[4px] bg-muted py-0.5 pl-2 pr-1 text-sm text-foreground"
                      >
                        <span className="truncate">{phone}</span>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            removeDraftPhone(index);
                          }}
                          className="interactive-press rounded p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                          aria-label={t("removePhone", { phone })}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                    <input
                      ref={draftPhoneInputRef}
                      id="draftClientPhone"
                      type="tel"
                      value={draftPhoneDraft}
                      onChange={(event) => setDraftPhoneDraft(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          commitDraftPhone();
                        }

                        if (
                          event.key === "Backspace" &&
                          draftPhoneDraft === "" &&
                          draftClientPhones.length > 0
                        ) {
                          removeDraftPhone(draftClientPhones.length - 1);
                        }
                      }}
                      placeholder={
                        draftClientPhones.length === 0 ? "0901234567" : t("addPhonePlaceholder")
                      }
                      className="min-w-[7rem] flex-1 border-0 bg-transparent px-1 py-0.5 text-sm outline-none placeholder:text-muted-foreground"
                    />
                  </div>
                </OutlinedField>
                <Button
                  type="button"
                  variant="outline"
                  onClick={commitDraftPhone}
                  className="interactive-press h-auto w-10 shrink-0 self-stretch rounded-[5px] p-0"
                  aria-label={t("addPhone")}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              <OutlinedField label={t("city")} htmlFor="draftClientCity">
                <CityAutocompleteInput
                  id="draftClientCity"
                  value={draftClientCity}
                  onChange={setDraftClientCity}
                  placeholder={t("cityPlaceholder")}
                  className={outlinedFieldInputClass}
                />
              </OutlinedField>

              <OutlinedField label={t("clientAddress")} htmlFor="draftClientAddress">
                <Input
                  id="draftClientAddress"
                  value={draftClientAddress}
                  onChange={(e) => setDraftClientAddress(e.target.value)}
                  placeholder={t("addressPlaceholder")}
                  className={outlinedFieldInputClass}
                />
              </OutlinedField>

              {draftClientError ? (
                <p className="text-sm text-red-600">{draftClientError}</p>
              ) : null}
            </div>

            <div className="flex justify-end gap-3 border-t border-border px-5 py-4 sm:px-6">
              <Button type="button" variant="outline" onClick={closeNewClientModal}>
                {tCommon("cancel")}
              </Button>
              <Button type="button" onClick={confirmNewClient}>
                {t("saveClient")}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>,
    document.body,
  );
}
