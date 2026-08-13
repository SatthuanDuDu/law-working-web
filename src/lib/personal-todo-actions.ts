"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { PersonalTodoRecurrence, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/session";
import { actionError } from "@/i18n/server-labels";
import {
  nextPersonalTodoDue,
  normalizeRecurrenceDays,
} from "@/lib/personal-todo-recurrence";

const titleSchema = z.string().trim().min(1).max(500);
const noteSchema = z.string().trim().max(4000).optional().nullable();
const dueDateSchema = z.string().optional().nullable();
const recurrenceSchema = z.enum(["NONE", "DAILY", "WEEKLY", "MONTHLY"]);

export type PersonalTodoItemDto = {
  id: string;
  title: string;
  isDone: boolean;
  position: number;
};

export type PersonalTodoDto = {
  id: string;
  title: string;
  note: string | null;
  isDone: boolean;
  dueDate: string | null;
  hasTime: boolean;
  recurrence: PersonalTodoRecurrence;
  recurrenceDays: number[];
  position: number;
  matterId: string | null;
  matter: { id: string; code: string; title: string } | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  items: PersonalTodoItemDto[];
};

function revalidatePersonalTodo() {
  revalidatePath("/dashboard");
}

type TodoRecord = Prisma.PersonalTodoGetPayload<{ include: typeof todoInclude }>;

function toDto(todo: TodoRecord): PersonalTodoDto {
  return {
    id: todo.id,
    title: todo.title,
    note: todo.note,
    isDone: todo.isDone,
    dueDate: todo.dueDate ? todo.dueDate.toISOString() : null,
    hasTime: todo.hasTime,
    recurrence: todo.recurrence,
    recurrenceDays: todo.recurrenceDays,
    position: todo.position,
    matterId: todo.matterId,
    matter: todo.matter,
    completedAt: todo.completedAt ? todo.completedAt.toISOString() : null,
    createdAt: todo.createdAt.toISOString(),
    updatedAt: todo.updatedAt.toISOString(),
    items: todo.items.map((item) => ({
      id: item.id,
      title: item.title,
      isDone: item.isDone,
      position: item.position,
    })),
  };
}

const todoInclude = {
  matter: { select: { id: true, code: true, title: true } },
  items: { orderBy: { position: "asc" as const } },
} as const;

async function requireOwnedTodo(id: string, ownerId: string) {
  const todo = await prisma.personalTodo.findFirst({
    where: { id, ownerId },
    include: todoInclude,
  });
  if (!todo) return null;
  return todo;
}

function parseRecurrence(
  value: string | undefined,
): PersonalTodoRecurrence | null {
  if (value === undefined) return null;
  const parsed = recurrenceSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export async function listPersonalTodosAction(): Promise<PersonalTodoDto[]> {
  const user = await requireAuth();
  const todos = await prisma.personalTodo.findMany({
    where: { ownerId: user.id },
    include: todoInclude,
    orderBy: [{ isDone: "asc" }, { position: "asc" }, { createdAt: "desc" }],
  });
  return todos.map(toDto);
}

export async function createPersonalTodoAction(input: {
  title: string;
  note?: string | null;
  dueDate?: string | null;
  hasTime?: boolean;
  recurrence?: PersonalTodoRecurrence;
  recurrenceDays?: number[];
  matterId?: string | null;
}): Promise<{ success?: true; error?: string; todo?: PersonalTodoDto }> {
  const user = await requireAuth();
  const title = titleSchema.safeParse(input.title);
  if (!title.success) {
    return { error: await actionError("invalidData") };
  }

  const noteParsed = noteSchema.safeParse(input.note ?? null);
  if (!noteParsed.success) {
    return { error: await actionError("invalidData") };
  }

  const dueRaw = dueDateSchema.safeParse(input.dueDate ?? null);
  if (!dueRaw.success) {
    return { error: await actionError("invalidData") };
  }

  const dueDate = dueRaw.data ? new Date(dueRaw.data) : null;
  if (dueDate && Number.isNaN(dueDate.getTime())) {
    return { error: await actionError("invalidData") };
  }

  const recurrence = parseRecurrence(input.recurrence) ?? "NONE";
  const recurrenceDays =
    recurrence === "WEEKLY" ? normalizeRecurrenceDays(input.recurrenceDays, dueDate) : [];

  const max = await prisma.personalTodo.aggregate({
    where: { ownerId: user.id, isDone: false },
    _max: { position: true },
  });

  const todo = await prisma.personalTodo.create({
    data: {
      ownerId: user.id,
      title: title.data,
      note: noteParsed.data || null,
      dueDate,
      hasTime: Boolean(input.hasTime && dueDate),
      recurrence,
      recurrenceDays,
      matterId: input.matterId || null,
      position: (max._max.position ?? -1) + 1,
    },
    include: todoInclude,
  });

  revalidatePersonalTodo();
  return { success: true, todo: toDto(todo) };
}

export async function updatePersonalTodoAction(input: {
  id: string;
  title?: string;
  note?: string | null;
  dueDate?: string | null;
  hasTime?: boolean;
  recurrence?: PersonalTodoRecurrence;
  recurrenceDays?: number[];
  matterId?: string | null;
}): Promise<{ success?: true; error?: string; todo?: PersonalTodoDto }> {
  const user = await requireAuth();
  const existing = await requireOwnedTodo(input.id, user.id);
  if (!existing) return { error: "Không tìm thấy" };

  const data: {
    title?: string;
    note?: string | null;
    dueDate?: Date | null;
    hasTime?: boolean;
    recurrence?: PersonalTodoRecurrence;
    recurrenceDays?: number[];
    matterId?: string | null;
  } = {};

  if (input.title !== undefined) {
    const title = titleSchema.safeParse(input.title);
    if (!title.success) return { error: await actionError("invalidData") };
    data.title = title.data;
  }
  if (input.note !== undefined) {
    const note = noteSchema.safeParse(input.note);
    if (!note.success) return { error: await actionError("invalidData") };
    data.note = note.data || null;
  }
  if (input.dueDate !== undefined) {
    data.dueDate = input.dueDate ? new Date(input.dueDate) : null;
    if (input.dueDate && Number.isNaN((data.dueDate as Date).getTime())) {
      return { error: await actionError("invalidData") };
    }
  }
  if (input.hasTime !== undefined) {
    data.hasTime = input.hasTime;
  }
  if (input.recurrence !== undefined) {
    const recurrence = parseRecurrence(input.recurrence);
    if (!recurrence) return { error: await actionError("invalidData") };
    data.recurrence = recurrence;
  }
  if (input.recurrenceDays !== undefined || input.recurrence !== undefined) {
    const recurrence = data.recurrence ?? existing.recurrence;
    const due =
      input.dueDate !== undefined
        ? input.dueDate
          ? new Date(input.dueDate)
          : null
        : existing.dueDate;
    data.recurrenceDays =
      recurrence === "WEEKLY"
        ? normalizeRecurrenceDays(input.recurrenceDays ?? existing.recurrenceDays, due)
        : [];
  }
  if (input.matterId !== undefined) {
    data.matterId = input.matterId || null;
  }
  if (data.dueDate === null) {
    data.hasTime = false;
  }

  const todo = await prisma.personalTodo.update({
    where: { id: existing.id },
    data,
    include: todoInclude,
  });

  revalidatePersonalTodo();
  return { success: true, todo: toDto(todo) };
}

export async function togglePersonalTodoDoneAction(
  id: string,
): Promise<{
  success?: true;
  error?: string;
  todo?: PersonalTodoDto;
  nextTodo?: PersonalTodoDto;
}> {
  const user = await requireAuth();
  const existing = await requireOwnedTodo(id, user.id);
  if (!existing) return { error: "Không tìm thấy" };

  const nextDone = !existing.isDone;

  const result = await prisma.$transaction(async (tx) => {
    const todo = await tx.personalTodo.update({
      where: { id: existing.id },
      data: {
        isDone: nextDone,
        completedAt: nextDone ? new Date() : null,
      },
      include: todoInclude,
    });

    if (!nextDone || existing.recurrence === "NONE") {
      return { todo, nextTodo: null as TodoRecord | null };
    }

    const from = existing.dueDate ?? new Date();
    const nextDue = nextPersonalTodoDue(
      from,
      existing.recurrence,
      existing.recurrenceDays,
      existing.hasTime,
    );
    if (!nextDue) return { todo, nextTodo: null };

    const max = await tx.personalTodo.aggregate({
      where: { ownerId: user.id, isDone: false },
      _max: { position: true },
    });

    const nextTodo = await tx.personalTodo.create({
      data: {
        ownerId: user.id,
        title: existing.title,
        note: existing.note,
        dueDate: nextDue,
        hasTime: existing.hasTime,
        recurrence: existing.recurrence,
        recurrenceDays: existing.recurrenceDays,
        matterId: existing.matterId,
        position: (max._max.position ?? -1) + 1,
        items:
          existing.items.length > 0
            ? {
                create: existing.items.map((item, index) => ({
                  title: item.title,
                  isDone: false,
                  position: index,
                })),
              }
            : undefined,
      },
      include: todoInclude,
    });

    return { todo, nextTodo };
  });

  revalidatePersonalTodo();
  return {
    success: true,
    todo: toDto(result.todo),
    nextTodo: result.nextTodo ? toDto(result.nextTodo) : undefined,
  };
}

export async function deletePersonalTodoAction(
  id: string,
): Promise<{ success?: true; error?: string }> {
  const user = await requireAuth();
  const existing = await prisma.personalTodo.findFirst({
    where: { id, ownerId: user.id },
    select: { id: true },
  });
  if (!existing) return { error: "Không tìm thấy" };

  await prisma.personalTodo.delete({ where: { id: existing.id } });
  revalidatePersonalTodo();
  return { success: true };
}

export async function reorderPersonalTodosAction(
  orderedIds: string[],
): Promise<{ success?: true; error?: string }> {
  const user = await requireAuth();
  if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
    return { error: await actionError("invalidData") };
  }

  const owned = await prisma.personalTodo.findMany({
    where: { ownerId: user.id, id: { in: orderedIds } },
    select: { id: true },
  });
  if (owned.length !== orderedIds.length) {
    return { error: "Không tìm thấy" };
  }

  await prisma.$transaction(
    orderedIds.map((id, index) =>
      prisma.personalTodo.update({
        where: { id },
        data: { position: index },
      }),
    ),
  );

  revalidatePersonalTodo();
  return { success: true };
}

export async function addPersonalTodoItemAction(input: {
  todoId: string;
  title: string;
}): Promise<{ success?: true; error?: string; todo?: PersonalTodoDto }> {
  const user = await requireAuth();
  const existing = await requireOwnedTodo(input.todoId, user.id);
  if (!existing) return { error: "Không tìm thấy" };

  const title = titleSchema.safeParse(input.title);
  if (!title.success) return { error: await actionError("invalidData") };

  const max = await prisma.personalTodoItem.aggregate({
    where: { todoId: existing.id },
    _max: { position: true },
  });

  await prisma.personalTodoItem.create({
    data: {
      todoId: existing.id,
      title: title.data,
      position: (max._max.position ?? -1) + 1,
    },
  });

  const todo = await requireOwnedTodo(existing.id, user.id);
  revalidatePersonalTodo();
  return { success: true, todo: todo ? toDto(todo) : undefined };
}

export async function togglePersonalTodoItemAction(
  itemId: string,
): Promise<{ success?: true; error?: string; todo?: PersonalTodoDto }> {
  const user = await requireAuth();
  const item = await prisma.personalTodoItem.findFirst({
    where: { id: itemId, todo: { ownerId: user.id } },
    select: { id: true, isDone: true, todoId: true },
  });
  if (!item) return { error: "Không tìm thấy" };

  await prisma.personalTodoItem.update({
    where: { id: item.id },
    data: { isDone: !item.isDone },
  });

  const todo = await requireOwnedTodo(item.todoId, user.id);
  revalidatePersonalTodo();
  return { success: true, todo: todo ? toDto(todo) : undefined };
}

export async function deletePersonalTodoItemAction(
  itemId: string,
): Promise<{ success?: true; error?: string; todo?: PersonalTodoDto }> {
  const user = await requireAuth();
  const item = await prisma.personalTodoItem.findFirst({
    where: { id: itemId, todo: { ownerId: user.id } },
    select: { id: true, todoId: true },
  });
  if (!item) return { error: "Không tìm thấy" };

  await prisma.personalTodoItem.delete({ where: { id: item.id } });
  const todo = await requireOwnedTodo(item.todoId, user.id);
  revalidatePersonalTodo();
  return { success: true, todo: todo ? toDto(todo) : undefined };
}
