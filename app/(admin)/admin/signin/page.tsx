import { redirect } from "next/navigation";

export default function AdminSignInPage() {
  redirect("/signin/?next=/admin/");
}
