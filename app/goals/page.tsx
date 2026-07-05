import { redirect } from "next/navigation";

export default function GoalsPage() {
  redirect("/tasks?filter=progress");
}
