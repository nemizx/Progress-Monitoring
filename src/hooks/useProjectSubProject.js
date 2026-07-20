import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';

/**
 * Shared Project → Sub Project selection state for feature pages.
 */
export function useProjectSubProject({ fetchWbs = false } = {}) {
  const { user } = useAuth();
  const [projectId, setProjectId] = useState('');
  const [subProjectId, setSubProjectId] = useState('');

  const { data: rawProjects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => base44.entities.Project.list('-created_date', 100),
  });

  const projects = useMemo(() => {
    if (!user || user.role === 'admin') return rawProjects;
    return rawProjects.filter(p => {
      const matchCompany = !user.company_access || p.client === user.company_access;
      const matchProject = !user.project_access_id || p.id === user.project_access_id;
      return matchCompany && matchProject;
    });
  }, [rawProjects, user]);

  const { data: subProjects = [], isLoading: loadingSubProjects } = useQuery({
    queryKey: ['subprojects', projectId],
    queryFn: () => base44.entities.SubProject.filter({ project_id: projectId }, '-created_date', 100),
    enabled: !!projectId,
  });

  const { data: wbsItems = [] } = useQuery({
    queryKey: ['wbs', projectId],
    queryFn: () => base44.entities.WBSItem.filter({ project_id: projectId }, 'order_index', 500),
    enabled: fetchWbs && !!projectId,
  });

  const handleProjectChange = (value) => {
    setProjectId(value);
    setSubProjectId('');
  };

  const isReady = !!projectId && !!subProjectId;
  const selectedProject = projects.find((p) => p.id === projectId);
  const selectedSubProject = subProjects.find((sp) => sp.id === subProjectId);

  return {
    projects,
    subProjects,
    wbsItems,
    projectId,
    subProjectId,
    setProjectId: handleProjectChange,
    setSubProjectId,
    isReady,
    loadingSubProjects,
    selectedProject,
    selectedSubProject,
  };
}
