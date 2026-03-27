import { redirect } from "next/navigation";
<html lang="fr" suppressHydrationWarning></html>

export default function HomePage() {
  redirect("/login");
}
