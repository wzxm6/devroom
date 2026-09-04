import { useState, useEffect, useCallback } from 'react';
import { Project, CreateProjectInput, UpdateProjectInput } from '@/types/project';
import { projectService } from '@/services/projectService';
import { useWorkspace } from '@/hooks/useWorkspace';
import { useAuth } from '@/hooks/useAuth';

export const useProjects = () => {
  const { currentWorkspace } = useWorkspace();
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProjects = useCallback(async () => {
    if (!currentWorkspace) {
      setProjects([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await projectService.getProjects(currentWorkspace.id);
      setProjects(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unable to load projects.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [currentWorkspace]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const createProject = async (input: CreateProjectInput): Promise<Project> => {
    if (!currentWorkspace || !user) {
      throw new Error('You must be in an active workspace to create a project.');
    }

    const newProject = await projectService.createProject(currentWorkspace.id, user.id, input);
    setProjects((prev) => [newProject, ...prev]);
    return newProject;
  };

  const updateProject = async (projectId: string, input: UpdateProjectInput): Promise<Project> => {
    const updated = await projectService.updateProject(projectId, input);
    setProjects((prev) => prev.map((p) => (p.id === projectId ? updated : p)));
    return updated;
  };

  const archiveProject = async (projectId: string): Promise<Project> => {
    const archived = await projectService.archiveProject(projectId);
    setProjects((prev) => prev.map((p) => (p.id === projectId ? archived : p)));
    return archived;
  };

  const deleteProject = async (projectId: string): Promise<void> => {
    await projectService.deleteProject(projectId);
    setProjects((prev) => prev.filter((p) => p.id !== projectId));
  };

  return {
    projects,
    loading,
    error,
    refreshProjects: fetchProjects,
    createProject,
    updateProject,
    archiveProject,
    deleteProject,
  };
};
