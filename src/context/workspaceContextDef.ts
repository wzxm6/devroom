import { createContext } from 'react';
import { WorkspaceContextType } from '@/types/workspace';

export const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);
