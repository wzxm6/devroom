// Deep-link resolution for activity events and notifications.
//
// Every target is derived from IDs the server wrote (never client input).
// If a referenced object was deleted, the target pages already render their
// own "not found / no permission" states, so links degrade gracefully.

interface Linkable {
  project_id: string | null;
  entity_type: string | null;
  entity_id: string | null;
  metadata?: Record<string, unknown>;
}

const metaString = (metadata: Record<string, unknown> | undefined, key: string): string | null => {
  const value = metadata?.[key];
  return typeof value === 'string' ? value : null;
};

export function buildDeepLink(item: Linkable): string | null {
  const { project_id: projectId, entity_type: entityType, entity_id: entityId } = item;

  switch (entityType) {
    case 'project':
      return entityId ? `/projects/${entityId}` : null;
    case 'post':
      return projectId && entityId ? `/projects/${projectId}/posts/${entityId}` : null;
    case 'comment': {
      // Comments live on the post detail page; the post id travels in metadata.
      const postId = metaString(item.metadata, 'post_id');
      return projectId && postId ? `/projects/${projectId}/posts/${postId}` : null;
    }
    case 'task':
      return projectId ? `/projects/${projectId}?tab=tasks` : null;
    case 'message':
      return projectId ? `/projects/${projectId}?tab=discussion` : '/chat';
    case 'file':
      return projectId ? `/projects/${projectId}?tab=files` : null;
    default:
      return projectId ? `/projects/${projectId}` : null;
  }
}
