import ProjectDetailsShell from "@/components/project-details-shell";

type ProjectPageProps = {
  params: Promise<{
    team_id: string;
    project_id: string;
  }>;
};

export default async function ProjectPage({ params }: ProjectPageProps) {
  const resolvedParams = await params;

  return (
    <ProjectDetailsShell
      teamId={resolvedParams.team_id}
      projectId={resolvedParams.project_id}
    />
  );
}
