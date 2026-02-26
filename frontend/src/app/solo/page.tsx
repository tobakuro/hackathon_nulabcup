import { auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function SoloPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/auth");
  }

  // モード選択は設定画面に統合されたため、直接 setup にリダイレクト
  redirect("/solo/setup");
}
