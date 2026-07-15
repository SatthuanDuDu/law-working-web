"use client";

import { createContext, useContext, useLayoutEffect, useState } from "react";

export type PageMeta = {
  title: string;
  description?: string;
};

type PageMetaContextValue = {
  meta: PageMeta;
  setMeta: (meta: PageMeta) => void;
};

const PageMetaContext = createContext<PageMetaContextValue | null>(null);

export function PageMetaProvider({
  children,
  initialMeta,
}: {
  children: React.ReactNode;
  initialMeta: PageMeta;
}) {
  const [meta, setMeta] = useState(initialMeta);

  return (
    <PageMetaContext.Provider value={{ meta, setMeta }}>
      {children}
    </PageMetaContext.Provider>
  );
}

export function usePageMeta() {
  const ctx = useContext(PageMetaContext);
  if (!ctx) throw new Error("usePageMeta must be used within PageMetaProvider");
  return ctx;
}

export function PageHeaderSlot({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  const { setMeta } = usePageMeta();

  useLayoutEffect(() => {
    setMeta({ title, description });
  }, [title, description, setMeta]);

  return null;
}
