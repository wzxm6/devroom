import React, { useEffect, useState, useCallback } from 'react';
import { Workspace, WorkspaceMember } from '@/types/workspace';
import { workspaceService } from '@/services/workspaceService';
import { useAuth } from '@/hooks/useAuth';
import { WorkspaceContext } from './workspaceContextDef';

export const WorkspaceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(null);
  const [userWorkspaces, setUserWorkspaces] = useState<Workspace[]>([]);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const maxMembers = 3;

  const loadWorkspaceDetails = useCallback(async (workspace: Workspace) => {
    try {
      const memberList = await workspaceService.getWorkspaceMembers(workspace.id);
      setMembers(memberList);
      localStorage.setItem('devroom_active_workspace_id', workspace.id);
    } catch (err) {
      console.error('Failed to load workspace members:', err);
    }
  }, []);

  const refreshWorkspace = useCallback(async () => {
    if (!user) {
      setCurrentWorkspace(null);
      setUserWorkspaces([]);
      setMembers([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const workspaces = await workspaceService.getUserWorkspaces(user.id);
      setUserWorkspaces(workspaces);

      if (workspaces.length > 0) {
        // Find previously selected or default to first
        const savedId = localStorage.getItem('devroom_active_workspace_id');
        const target = workspaces.find((w) => w.id === savedId) || workspaces[0];
        setCurrentWorkspace(target);
        await loadWorkspaceDetails(target);
      } else {
        setCurrentWorkspace(null);
        setMembers([]);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load workspaces';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [user, loadWorkspaceDetails]);

  useEffect(() => {
    refreshWorkspace();
  }, [refreshWorkspace]);

  const switchWorkspace = async (workspaceId: string) => {
    const target = userWorkspaces.find((w) => w.id === workspaceId);
    if (target) {
      setCurrentWorkspace(target);
      await loadWorkspaceDetails(target);
    }
  };

  const createWorkspace = async (name: string): Promise<Workspace> => {
    if (!user) throw new Error('You must be logged in to create a workspace.');
    setError(null);

    try {
      const newWs = await workspaceService.createWorkspace(name, user.id);
      setUserWorkspaces((prev) => [newWs, ...prev]);
      setCurrentWorkspace(newWs);
      await loadWorkspaceDetails(newWs);
      return newWs;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create workspace';
      setError(msg);
      throw err;
    }
  };

  const joinWorkspace = async (inviteCode: string) => {
    if (!user) throw new Error('You must be logged in to join a workspace.');
    setError(null);

    try {
      const result = await workspaceService.joinWorkspaceByInvite(inviteCode);
      await refreshWorkspace();
      if (result.workspace_id) {
        const joinedWs = await workspaceService.getWorkspace(result.workspace_id);
        if (joinedWs) {
          setCurrentWorkspace(joinedWs);
          await loadWorkspaceDetails(joinedWs);
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to join workspace';
      setError(msg);
      throw err;
    }
  };

  const isOwner = Boolean(currentWorkspace && user && currentWorkspace.owner_id === user.id);

  return (
    <WorkspaceContext.Provider
      value={{
        currentWorkspace,
        userWorkspaces,
        members,
        memberCount: members.length,
        maxMembers,
        isOwner,
        loading,
        error,
        switchWorkspace,
        createWorkspace,
        joinWorkspace,
        refreshWorkspace,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
};
