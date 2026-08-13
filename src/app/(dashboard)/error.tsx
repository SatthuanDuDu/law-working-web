"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

// EN fallback (if i18n later): "Something went wrong" / "Try again"
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-foreground">
          Đã xảy ra lỗi
        </h2>
        <p className="max-w-md text-sm text-muted-foreground">
          Không tải được trang này. Bạn có thể thử lại.
        </p>
      </div>
      <Button type="button" onClick={reset}>
        Thử lại
      </Button>
    </div>
  );
}
