import { describe, it, expect } from 'vitest';
import { buildDeepLink } from './activityLinks';

describe('buildDeepLink', () => {
  it('links projects directly', () => {
    expect(
      buildDeepLink({ project_id: 'p1', entity_type: 'project', entity_id: 'p1' })
    ).toBe('/projects/p1');
    expect(buildDeepLink({ project_id: null, entity_type: 'project', entity_id: null })).toBeNull();
  });

  it('links posts and comments to the post detail page', () => {
    expect(
      buildDeepLink({ project_id: 'p1', entity_type: 'post', entity_id: 'post9' })
    ).toBe('/projects/p1/posts/post9');
    expect(
      buildDeepLink({
        project_id: 'p1',
        entity_type: 'comment',
        entity_id: 'c1',
        metadata: { post_id: 'post9' },
      })
    ).toBe('/projects/p1/posts/post9');
    // Comment without a resolvable post has no valid target
    expect(
      buildDeepLink({ project_id: 'p1', entity_type: 'comment', entity_id: 'c1', metadata: {} })
    ).toBeNull();
  });

  it('links tasks, messages, and files to their tabs', () => {
    expect(buildDeepLink({ project_id: 'p1', entity_type: 'task', entity_id: 't1' })).toBe(
      '/projects/p1?tab=tasks'
    );
    expect(buildDeepLink({ project_id: 'p1', entity_type: 'message', entity_id: 'm1' })).toBe(
      '/projects/p1?tab=discussion'
    );
    expect(buildDeepLink({ project_id: null, entity_type: 'message', entity_id: 'm1' })).toBe(
      '/chat'
    );
    expect(buildDeepLink({ project_id: 'p1', entity_type: 'file', entity_id: 'f1' })).toBe(
      '/projects/p1?tab=files'
    );
  });

  it('falls back safely for unknown or unscoped entities', () => {
    expect(buildDeepLink({ project_id: 'p1', entity_type: 'unknown', entity_id: 'x' })).toBe(
      '/projects/p1'
    );
    expect(buildDeepLink({ project_id: null, entity_type: 'task', entity_id: 't1' })).toBeNull();
  });
});
