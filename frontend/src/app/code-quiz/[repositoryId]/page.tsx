import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { repositories } from "@/db/schema";
import CodeQuizGame from "./CodeQuizGame";

interface PageProps {
  params: Promise<{ repositoryId: string }>;
}

export default async function CodeQuizGamePage({ params }: PageProps) {
  const session = await auth();
  if (!session || !session.user?.id) {
    redirect("/auth");
  }

  const { repositoryId } = await params;

  const [repo] = await db
    .select({
      id: repositories.id,
      fullName: repositories.fullName,
    })
    .from(repositories)
    .where(eq(repositories.id, repositoryId))
    .limit(1);

  if (!repo) {
    redirect("/code-quiz");
  }

  return <CodeQuizGame repositoryId={repo.id} repositoryName={repo.fullName} />;
}
