import { describe, it, expect } from 'vitest';
import { describeActivity, activityExcerpt } from './activityText';
import { ActivityEvent } from '@/types/activity';

const base: ActivityEvent = {
  id: 'event-1',
  workspace_id: 'ws-1',
  project_id: 'proj-1',
  actor_id: 'user-1',
  entity_type: 'task',
  entity_id: 'task-1',
  action: 'task.created',
  metadata: {},
  created_at: new Date().toISOString(),
  actor: {
    id: 'user-1',
    username: 'sara',
    display_name: 'Sara',
    avatar_url: null,
    created_at: '',
    updated_at: '',
  },
};

const withAction = (action: string, metadata: Record<string, unknown> = {}): ActivityEvent => ({
  ...base,
  action,
  metadata,
});

describe('describeActivity', () => {
  it('phrases task lifecycle events', () => {
    expect(describeActivity(withAction('task.created', { title: 'Fix auth' }))).toBe(
      'Sara created task "Fix auth"'
    );
    expect(
      describeActivity(withAction('task.status_changed', { title: 'Fix auth', new_status: 'DONE' }))
    ).toBe('Sara completed "Fix auth"');
    expect(
      describeActivity(
        withAction('task.status_changed', { title: 'Fix auth', new_status: 'IN_PROGRESS' })
      )
    ).toBe('Sara moved "Fix auth" to In Progress');
  });

  it('phrases project, post, comment, message, and file events', () => {
    expect(describeActivity({ ...base, entity_type: 'project', action: 'project.created', metadata: { title: 'Web' } })).toBe(
      'Sara created project "Web"'
    );
    expect(
      describeActivity({
        ...base,
        entity_type: 'project',
        action: 'project.status_changed',
        metadata: { title: 'Web', old_status: 'PLANNING', new_status: 'ACTIVE' },
      })
    ).toContain('PLANNING');
    expect(describeActivity({ ...base, entity_type: 'post', action: 'post.created', metadata: { title: 'RFC' } })).toBe(
      'Sara posted "RFC"'
    );
    expect(describeActivity({ ...base, entity_type: 'comment', action: 'comment.created' })).toBe(
      'Sara added a comment'
    );
    expect(describeActivity({ ...base, entity_type: 'message', action: 'message.sent' })).toBe(
      'Sara sent a message'
    );
    expect(
      describeActivity({ ...base, entity_type: 'file', action: 'file.uploaded', metadata: { filename: 'a.pdf' } })
    ).toBe('Sara uploaded a.pdf');
  });

  it('falls back for missing actors and unknown actions', () => {
    expect(describeActivity({ ...base, actor: undefined, actor_id: null })).toContain('Someone');
    expect(describeActivity(withAction('something.new'))).toBe('Sara made an update');
  });
});

describe('activityExcerpt', () => {
  it('returns excerpts only for messages and new comments', () => {
    expect(
      activityExcerpt({ ...base, entity_type: 'message', action: 'message.sent', metadata: { excerpt: 'hi' } })
    ).toBe('hi');
    expect(
      activityExcerpt({ ...base, entity_type: 'comment', action: 'comment.created', metadata: { excerpt: 'nice' } })
    ).toBe('nice');
    expect(activityExcerpt(withAction('task.created', { title: 'x' }))).toBeNull();
    expect(activityExcerpt({ ...base, entity_type: 'message', action: 'message.sent', metadata: {} })).toBeNull();
  });
});
