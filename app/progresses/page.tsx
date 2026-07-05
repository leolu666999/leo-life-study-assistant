import { redirect } from "next/navigation";

export default function ProgressesPage() {
  redirect("/tasks?filter=progress");
}
