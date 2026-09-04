import React, { useMemo } from 'react';
import { useWorkspace } from '@/hooks/useWorkspace';

interface ChatMessageContentProps {
  content: string;
}

// Plain-text rendering with @mention highlighting.
//
// Everything renders as React text nodes (never innerHTML), so user content
// is inherently escaped. @username tokens that match a workspace member are
// wrapped in a highlight span; all other text is left untouched.
export const ChatMessageContent: React.FC<ChatMessageContentProps> = ({ content }) => {
  const { members } = useWorkspace();

  const usernames = useMemo(() => {
    const set = new Set<string>();
    members.forEach((m) => {
      if (m.profile?.username) set.add(m.profile.username.toLowerCase());
    });
    return set;
  }, [members]);

  const parts = useMemo(() => {
    const tokens = content.split(/(@[A-Za-z0-9_]+)/g);
    return tokens.map((token, index) => {
      if (token.startsWith('@') && usernames.has(token.slice(1).toLowerCase())) {
        return (
          <span
            key={index}
            className="font-semibold text-primary bg-primary/10 px-1 rounded"
          >
            {token}
          </span>
        );
      }
      return <React.Fragment key={index}>{token}</React.Fragment>;
    });
  }, [content, usernames]);

  return <>{parts}</>;
};
