import { describe, it, expect, vi } from 'vitest';

// Hermetic offline simulation: force the unconfigured state regardless of
// any local .env.local (Vite loads dotenv files into import.meta.env, so
// without this mock the suite would hit the network on configured machines).
vi.mock('@/lib/supabase/config', () => ({
  supabaseConfig: {
    supabaseUrl: '',
    supabaseAnonKey: '',
    isConfigured: false,
    isDemoMode: false,
  },
}));

import { supabaseConfig } from '@/lib/supabase/config';
import { taskService } from './taskService';
import { postService } from './postService';
import { commentService } from './commentService';
import { chatService } from './chatService';
import { projectFileService } from './projectFileService';
import { activityService } from './activityService';
import { notificationService } from './notificationService';

// These tests run with no Supabase credentials configured, so every service
// must degrade deterministically: reads return empty, counts return zero,
// and writes throw explicit "not configured" errors instead of hanging or
// leaking unauthenticated requests.

describe('offline service guards', () => {
  it('runs without Supabase configured', () => {
    expect(supabaseConfig.isConfigured).toBe(false);
  });

  it('list queries resolve to empty arrays', async () => {
    await expect(taskService.getProjectTasks('ws')).resolves.toEqual([]);
    await expect(taskService.getWorkspaceTasks('ws')).resolves.toEqual([]);
    await expect(postService.getProjectPosts('p')).resolves.toEqual([]);
    await expect(commentService.getPostComments('p')).resolves.toEqual([]);
    await expect(chatService.getWorkspaceMessages('ws')).resolves.toEqual([]);
    await expect(chatService.getProjectMessages('p')).resolves.toEqual([]);
    await expect(projectFileService.getProjectFiles('p')).resolves.toEqual([]);
    await expect(activityService.getWorkspaceActivity('ws')).resolves.toEqual([]);
    await expect(activityService.getProjectActivity('p')).resolves.toEqual([]);
    await expect(notificationService.getMyNotifications('u')).resolves.toEqual([]);
  });

  it('counts resolve to zero and void mutations resolve silently', async () => {
    await expect(notificationService.getUnreadCount('u')).resolves.toBe(0);
    await expect(notificationService.markRead('n')).resolves.toBeUndefined();
    await expect(notificationService.markAllRead()).resolves.toBeUndefined();
  });

  it('writes throw explicit configuration errors', async () => {
    await expect(
      taskService.createTask('p', 'u', { title: 'x' })
    ).rejects.toThrow(/not configured/i);
    await expect(
      chatService.sendWorkspaceMessage('ws', 'u', { content: 'hi' })
    ).rejects.toThrow(/not configured/i);
    await expect(chatService.editMessage('m', { content: 'hi' })).rejects.toThrow(
      /not configured/i
    );
    await expect(
      projectFileService.uploadProjectFile('ws', 'p', 'u', new File(['x'], 'a.txt'))
    ).rejects.toThrow(/not configured/i);
  });
});
