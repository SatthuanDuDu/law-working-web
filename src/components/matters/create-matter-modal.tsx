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
  MATTER_TYPE_LABELS,
  ROLE_LABELS,
  VIETNAM_CITY_SUGGESTIONS,
} from "@/lib/constants";
import { useConfirmDialog } from "@/hooks/use-confirm-dialog";
import { useOverlayAnimation } from "@/hooks/use-overlay-animation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label, Select } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const matterTypeControlClass =
  "interactive-field h-full w-full appearance-none rounded-[5px] border-0 bg-white pl-5 pr-12 text-base font-bold text-slate-900 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40";

const matterTypeChevronClass =
  "absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500";

const outlinedFieldLabelClass =
  "pointer-events-none absolute left-3 top-0 z-[1] -translate-y-1/2 bg-white px-1.5 text-sm font-medium text-slate-700";

const outlinedFieldInputClass =
  "interactive-field w-full rounded-[5px] border border-slate-300 bg-white px-3 pb-2.5 pt-3";

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
  name: string;
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
          className="absolute left-0 right-0 top-full z-20 mt-1 max-h-48 overflow-y-auto rounded-[5px] border border-slate-300 bg-white py-1 shadow-lg"
        >
          {suggestions.map((city, index) => (
            <li key={city} role="option" aria-selected={index === highlightIndex}>
              <button
                type="button"
                className={cn(
                  "interactive-press w-full px-3 py-2 text-left text-sm transition-colors",
                  index === highlightIndex
                    ? "bg-primary-muted font-medium text-primary"
                    : "text-slate-700 hover:bg-slate-50",
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
    <OutlinedField label="Cộng sự" htmlFor={id}>
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
              className="inline-flex max-w-full items-center gap-1 rounded-[4px] bg-slate-100 py-0.5 pl-2 pr-1 text-sm text-slate-800"
            >
              <span className="truncate">
                {member.name} ({ROLE_LABELS[member.role]})
              </span>
              <button
                type="button"
                onClick={() => removeMember(memberId)}
                className="interactive-press rounded p-0.5 text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-700"
                aria-label={`Xóa ${member.name}`}
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
              ? "cursor-not-allowed text-slate-400"
              : "cursor-pointer text-slate-700",
          )}
        >
          <option value="">
            {availableMembers.length === 0
              ? "Không còn cộng sự để chọn"
              : selectedIds.length === 0
                ? "Chọn cộng sự..."
                : "Thêm cộng sự..."}
          </option>
          {availableMembers.map((member) => (
            <option key={member.id} value={member.id}>
              {member.name} ({ROLE_LABELS[member.role]})
            </option>
          ))}
        </select>
        <ChevronDown
          className="pointer-events-none -ml-5 h-4 w-4 shrink-0 text-slate-500"
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
    <div className="mt-3 max-h-[min(50vh,420px)] overflow-y-auto rounded-[5px] border border-slate-200">
      <table className="w-full text-sm">
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className="border-b border-slate-100 last:border-0">
              <th
                scope="row"
                className="w-[38%] bg-slate-50 px-3 py-2.5 text-left align-top font-medium text-slate-600"
              >
                {row.label}
              </th>
              <td className="break-words px-3 py-2.5 text-slate-900 whitespace-pre-wrap">
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
  const router = useRouter();
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const { confirm, dialog } = useConfirmDialog();
  const { mounted, active } = useOverlayAnimation(open);

  const [type, setType] = useState<MatterType>("CIVIL");
  const [customTypeLabel, setCustomTypeLabel] = useState("");
  const [customTypeInputOpen, setCustomTypeInputOpen] = useState(false);
  const [clientMode, setClientMode] = useState<"existing" | "new">("new");
  const [selectedClientId, setSelectedClientId] = useState("");
  const [clientPhones, setClientPhones] = useState<string[]>([]);
  const [phoneDraft, setPhoneDraft] = useState("");
  const phoneInputRef = useRef<HTMLInputElement>(null);
  const [clientAddress, setClientAddress] = useState("");
  const [clientCity, setClientCity] = useState("");
  const [leadLawyerId, setLeadLawyerId] = useState(() => getDefaultLeadLawyerId(formData));
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [formKey, setFormKey] = useState(0);
  const typeSelectRef = useRef<HTMLSelectElement>(null);
  const clientToggleRef = useRef<HTMLDivElement>(null);
  const newClientTabRef = useRef<HTMLButtonElement>(null);
  const existingClientTabRef = useRef<HTMLButtonElement>(null);
  const [clientToggleIndicator, setClientToggleIndicator] = useState({
    left: 0,
    width: 0,
    ready: false,
  });

  const applyEditMatter = useCallback((matter: MatterEditInitial) => {
    setType(matter.type);
    setCustomTypeLabel(matter.customTypeLabel ?? "");
    setCustomTypeInputOpen(matter.type === "OTHER");
    setClientMode("existing");
    setSelectedClientId(matter.clientId);
    setClientPhones(parseClientPhones(matter.clientPhone));
    setPhoneDraft("");
    setClientAddress(matter.clientAddress ?? "");
    setClientCity(matter.clientCity ?? "");
    setLeadLawyerId(matter.leadLawyerId);
    setSelectedMembers(matter.memberIds.filter((id) => id !== matter.leadLawyerId));
    setFormKey((key) => key + 1);
  }, []);

  const resetCreateFields = useCallback(() => {
    setClientMode("new");
    setSelectedClientId("");
    setClientPhones([]);
    setPhoneDraft("");
    setClientAddress("");
    setClientCity("");
    setSelectedMembers([]);
    setCustomTypeLabel("");
    setCustomTypeInputOpen(false);
    setType("CIVIL");
    setLeadLawyerId(getDefaultLeadLawyerId(formData));
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

  const updateClientToggleIndicator = useCallback(() => {
    const activeTab =
      clientMode === "new" ? newClientTabRef.current : existingClientTabRef.current;

    if (!activeTab) return;

    setClientToggleIndicator({
      left: activeTab.offsetLeft,
      width: activeTab.offsetWidth,
      ready: true,
    });
  }, [clientMode]);

  useEffect(() => {
    updateClientToggleIndicator();

    const container = clientToggleRef.current;
    if (!container) return;

    const observer = new ResizeObserver(() => updateClientToggleIndicator());
    observer.observe(container);

    const newTab = newClientTabRef.current;
    const existingTab = existingClientTabRef.current;
    if (newTab) observer.observe(newTab);
    if (existingTab) observer.observe(existingTab);

    return () => observer.disconnect();
  }, [updateClientToggleIndicator, mounted, active]);

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
    resetCreateFields();
    onClose();
  }, [onClose, resetCreateFields]);

  useEffect(() => {
    if (!mounted) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") handleClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [mounted, handleClose]);

  if (!mounted || typeof document === "undefined") return null;

  function resetClientFieldsForNewMode() {
    setSelectedClientId("");
    setClientPhones([]);
    setPhoneDraft("");
    setClientAddress("");
    setClientCity("");
  }

  function handleClientChange(clientId: string) {
    setSelectedClientId(clientId);
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
        : MATTER_TYPE_LABELS[type];
    const selectedClient = formData.clients.find((client) => client.id === selectedClientId);
    const leadLawyer =
      formData.lawyers.find((lawyer) => lawyer.id === leadLawyerId) ?? formData.currentUser;
    const associates = selectedMembers
      .map((memberId) => formData.members.find((member) => member.id === memberId))
      .filter((member): member is MatterFormData["members"][number] => Boolean(member));

    const summaryRows = [
      { label: "Mã vụ việc", value: previewCode },
      { label: "Tên vụ việc", value: title },
      { label: "Mô tả", value: description },
      { label: "Loại vụ", value: typeLabel },
      {
        label: "Loại khách hàng",
        value: clientMode === "new" ? "Khách hàng mới" : "Khách hàng có sẵn",
      },
      {
        label: "Tên khách hàng",
        value: clientMode === "existing" ? (selectedClient?.name ?? "") : clientName,
      },
      { label: "SĐT khách hàng", value: phones.join(", ") },
      { label: "Thành phố", value: clientCity.trim() },
      { label: "Địa chỉ khách hàng", value: clientAddress.trim() },
      {
        label: "Luật sư chính",
        value: `${leadLawyer.name} (${ROLE_LABELS[leadLawyer.role]})`,
      },
      {
        label: "Cộng sự",
        value:
          associates.length > 0
            ? associates.map((member) => `${member.name} (${ROLE_LABELS[member.role]})`).join("\n")
            : "",
      },
    ];

    confirm({
      title: isEdit ? "Xác nhận cập nhật vụ việc" : "Xác nhận tạo vụ việc",
      message: isEdit
        ? "Vui lòng kiểm tra lại thông tin trước khi lưu."
        : "Vui lòng kiểm tra lại thông tin trước khi tạo vụ việc.",
      content: <CreateMatterSummaryTable rows={summaryRows} />,
      confirmLabel: isEdit ? "Xác nhận lưu" : "Xác nhận tạo",
      cancelLabel: "Quay lại",
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
          aria-label="Đóng form tạo vụ việc"
          className={cn(
            "overlay-backdrop absolute inset-0 bg-black/40 backdrop-blur-[1px]",
            active && "is-active",
          )}
          onClick={handleClose}
        />
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-matter-title"
          className={cn(
            "overlay-panel relative z-10 flex h-dvh max-h-none w-full max-w-none flex-col overflow-hidden rounded-none border-0 bg-white shadow-2xl sm:h-auto sm:max-h-[min(90dvh,900px)] sm:max-w-2xl sm:rounded-2xl sm:border sm:border-slate-200",
            active && "is-active",
          )}
        >
          <div className="flex items-start justify-between border-b border-slate-200 px-6 py-4">
            <div>
              <h2 id="create-matter-title" className="text-xl font-semibold text-primary">
                {isEdit ? "Sửa vụ việc" : "Tạo vụ việc mới"}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                {isEdit
                  ? "Cập nhật thông tin vụ việc. Mã vụ việc được giữ nguyên."
                  : "Trạng thái mặc định: Mới. Nhân viên có thể cập nhật khi bắt đầu xử lý."}
              </p>
            </div>
            <Button type="button" variant="ghost" size="icon" onClick={handleClose} aria-label="Đóng">
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

              <div className="sticky top-0 z-10 relative isolate pb-4">
                <div
                  aria-hidden
                  className="pointer-events-none absolute -left-6 -right-6 -top-6 bottom-0 z-0 bg-white sm:-left-8 sm:-right-8 sm:-top-7"
                />
                <div className="relative z-[1] grid w-full grid-cols-1 gap-4 rounded-[5px] bg-primary px-4 py-4 shadow-md md:grid-cols-2 md:items-center md:gap-6">
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
                    Loại vụ
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
                      {Object.entries(MATTER_TYPE_LABELS).map(([value, label]) => (
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
                        placeholder="Nhập loại vụ..."
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
                        "rounded p-0.5 hover:bg-slate-100 hover:text-slate-800",
                      )}
                      aria-label="Mở danh sách loại vụ"
                    >
                      <ChevronDown className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                </div>
              </div>

              <div className="relative">
                <Input
                  id="title"
                  name="title"
                  required
                  defaultValue={editMatter?.title ?? ""}
                  placeholder="Nhập tên vụ việc"
                  className={outlinedFieldInputClass}
                />
                <Label htmlFor="title" className={outlinedFieldLabelClass}>
                  Tên vụ việc
                </Label>
              </div>

              <div className="relative">
                <Textarea
                  id="description"
                  name="description"
                  rows={3}
                  defaultValue={editMatter?.description ?? ""}
                  placeholder="Mô tả ngắn về vụ việc"
                  className={cn(outlinedFieldInputClass, "min-h-[6.5rem] resize-y")}
                />
                <Label htmlFor="description" className={outlinedFieldLabelClass}>
                  Mô tả
                </Label>
              </div>

              <div className="relative rounded-[5px] border border-slate-300 px-4 pb-5 pt-8">
                <div className="absolute left-3 top-0 -translate-y-1/2">
                  <div
                    ref={clientToggleRef}
                    className="relative inline-flex items-center rounded-[5px] bg-primary py-1 pl-2 pr-1 text-white shadow-sm"
                    role="tablist"
                    aria-label="Khách hàng"
                  >
                    <div className="flex shrink-0 items-center gap-2 px-2 py-1 text-base font-semibold">
                      <Users className="h-4 w-4 shrink-0" aria-hidden />
                      Khách hàng
                    </div>

                    <span className="mx-0.5 h-5 w-px shrink-0 bg-white/25" aria-hidden />

                    <span
                      aria-hidden
                      className={cn(
                        "absolute inset-y-1 rounded-[4px] bg-white/35 shadow-[inset_0_1px_0_rgba(255,255,255,0.2)] transition-[left,width] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
                        clientToggleIndicator.ready ? "opacity-100" : "opacity-0",
                      )}
                      style={{
                        left: clientToggleIndicator.left,
                        width: clientToggleIndicator.width,
                      }}
                    />
                    <button
                      ref={newClientTabRef}
                      type="button"
                      role="tab"
                      aria-selected={clientMode === "new"}
                      className={cn(
                        "interactive-press relative z-[1] whitespace-nowrap rounded-[4px] px-3 py-1.5 text-sm transition-all duration-300",
                        clientMode === "new"
                          ? "font-semibold text-white"
                          : "font-normal text-white/40 hover:bg-white/10 hover:text-white/80",
                      )}
                      onClick={() => {
                        setClientMode("new");
                        resetClientFieldsForNewMode();
                      }}
                    >
                      Khách hàng mới
                    </button>
                    <button
                      ref={existingClientTabRef}
                      type="button"
                      role="tab"
                      aria-selected={clientMode === "existing"}
                      className={cn(
                        "interactive-press relative z-[1] whitespace-nowrap rounded-[4px] px-3 py-1.5 text-sm transition-all duration-300",
                        clientMode === "existing"
                          ? "font-semibold text-white"
                          : "font-normal text-white/40 hover:bg-white/10 hover:text-white/80",
                      )}
                      onClick={() => {
                        setClientMode("existing");
                        resetClientFieldsForNewMode();
                      }}
                    >
                      Khách hàng có sẵn
                    </button>
                  </div>
                </div>

                <div className="space-y-7">
                  {clientMode === "existing" ? (
                    <OutlinedField label="Chọn khách hàng" htmlFor="clientId">
                      <Select
                        id="clientId"
                        name="clientId"
                        value={selectedClientId}
                        onChange={(e) => handleClientChange(e.target.value)}
                        className={cn(outlinedFieldInputClass, "h-11")}
                      >
                        <option value="">-- Chọn khách hàng --</option>
                        {formData.clients.map((client) => (
                          <option key={client.id} value={client.id}>
                            {client.name}
                          </option>
                        ))}
                      </Select>
                    </OutlinedField>
                  ) : (
                    <OutlinedField label="Họ và tên khách hàng" htmlFor="clientName">
                      <Input
                        id="clientName"
                        name="clientName"
                        placeholder="Nguyễn Văn A"
                        required={clientMode === "new"}
                        className={outlinedFieldInputClass}
                      />
                    </OutlinedField>
                  )}

                  <div className="flex items-stretch gap-2">
                    <OutlinedField
                      label="SĐT khách hàng"
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
                            className="client-phone-chip inline-flex max-w-full items-center gap-1 rounded-[4px] bg-slate-100 py-0.5 pl-2 pr-1 text-sm text-slate-800"
                          >
                            <span className="truncate">{phone}</span>
                            <button
                              type="button"
                              disabled={clientFieldsDisabled}
                              onClick={(event) => {
                                event.stopPropagation();
                                removeClientPhone(index);
                              }}
                              className="interactive-press rounded p-0.5 text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-700 disabled:pointer-events-none"
                              aria-label={`Xóa số ${phone}`}
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
                            clientPhones.length === 0 ? "0901234567" : "Thêm SĐT..."
                          }
                          className="min-w-[7rem] flex-1 border-0 bg-transparent px-1 py-0.5 text-sm outline-none placeholder:text-slate-400 disabled:cursor-not-allowed disabled:opacity-50"
                        />
                      </div>
                    </OutlinedField>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={clientFieldsDisabled}
                      onClick={commitPhoneDraft}
                      className="interactive-press h-auto w-10 shrink-0 self-stretch rounded-[5px] p-0"
                      aria-label="Thêm số điện thoại"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>

                  <OutlinedField label="Thành phố" htmlFor="clientCity">
                    <CityAutocompleteInput
                      id="clientCity"
                      name="clientCity"
                      value={clientCity}
                      onChange={setClientCity}
                      placeholder="Hà Nội"
                      disabled={clientFieldsDisabled}
                      className={outlinedFieldInputClass}
                    />
                  </OutlinedField>

                  <OutlinedField label="Địa chỉ khách hàng" htmlFor="clientAddress">
                    <Input
                      id="clientAddress"
                      name="clientAddress"
                      value={clientAddress}
                      onChange={(e) => setClientAddress(e.target.value)}
                      placeholder="Số nhà, đường, quận/huyện"
                      disabled={clientFieldsDisabled}
                      className={outlinedFieldInputClass}
                    />
                  </OutlinedField>
                </div>
              </div>

              <div className="relative rounded-[5px] border border-slate-300 px-4 pb-5 pt-8">
                <div className="absolute left-3 top-0 -translate-y-1/2">
                  <div className="flex items-center gap-2 rounded-[5px] bg-primary px-3 py-1.5 text-base font-semibold text-white shadow-sm">
                    <Scale className="h-4 w-4 shrink-0" aria-hidden />
                    Luật sư phụ trách
                  </div>
                </div>

                <div className="space-y-7">
                  {canPickLeadLawyer ? (
                    <OutlinedField label="Luật sư chính" htmlFor="leadLawyerDisplay">
                      <div className="relative">
                        <Select
                          id="leadLawyerDisplay"
                          value={leadLawyerId}
                          onChange={(event) => setLeadLawyerId(event.target.value)}
                          className={cn(outlinedFieldInputClass, "h-11 appearance-none pr-10")}
                        >
                          {formData.lawyers.map((lawyer) => (
                            <option key={lawyer.id} value={lawyer.id}>
                              {lawyer.name} ({ROLE_LABELS[lawyer.role]})
                            </option>
                          ))}
                        </Select>
                        <ChevronDown
                          className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
                          aria-hidden
                        />
                      </div>
                    </OutlinedField>
                  ) : (
                    <OutlinedField label="Luật sư chính" htmlFor="leadLawyerDisplay">
                      <Input
                        id="leadLawyerDisplay"
                        value={`${formData.currentUser.name} (${ROLE_LABELS[formData.currentUser.role]})`}
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

              <div className="flex justify-end gap-3 border-t border-slate-200 pt-6">
                <Button type="button" variant="outline" onClick={handleClose}>
                  Hủy
                </Button>
                <Button type="submit" disabled={isPending}>
                  {isPending
                    ? isEdit
                      ? "Đang lưu..."
                      : "Đang tạo..."
                    : isEdit
                      ? "Lưu thay đổi"
                      : "Tạo vụ việc"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>,
    document.body,
  );
}
