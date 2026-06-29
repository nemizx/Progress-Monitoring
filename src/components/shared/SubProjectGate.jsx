import EmptyState from '@/components/shared/EmptyState';
import { Building2, Layers } from 'lucide-react';

/**
 * Renders children only when project + sub-project are selected.
 */
export default function SubProjectGate({
  projectId,
  subProjectId,
  subProjects = [],
  children,
  projectMessage = 'Choose a project first, then select a sub-project to continue.',
  subProjectMessage = 'Choose a sub-project to view and manage data for this tower, block, or phase.',
  noSubProjectsMessage = 'Add sub-projects (towers, blocks, phases) under Projects before using this feature.',
}) {
  if (!projectId) {
    return (
      <EmptyState
        icon={Layers}
        title="Select a project"
        description={projectMessage}
      />
    );
  }

  if (!subProjectId) {
    if (subProjects.length === 0) {
      return (
        <EmptyState
          icon={Building2}
          title="No sub-projects"
          description={noSubProjectsMessage}
        />
      );
    }
    return (
      <EmptyState
        icon={Building2}
        title="Select a sub-project"
        description={subProjectMessage}
      />
    );
  }

  return children;
}
