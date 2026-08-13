import { redirect } from "next/navigation";

/** Checklist cá nhân giờ ở panel header (kiểu Gmail Tasks). Bookmark cũ → giao việc. */
export default function MyWorkPage() {
  redirect("/tasks");
}
