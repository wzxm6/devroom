import React, { useRef } from 'react';
import { FolderUp, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ALLOWED_FILE_EXTENSIONS } from '@/types/projectFile';

interface FolderUploadButtonProps {
  onSelect: (files: File[]) => Promise<void>;
  uploading: boolean;
  disabled?: boolean;
}

export const FolderUploadButton: React.FC<FolderUploadButtonProps> = ({
  onSelect,
  uploading,
  disabled = false,
}) => {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    // Reset so the same folder can be picked again after an error
    e.target.value = '';
    if (files.length === 0) return;
    try {
      await onSelect(files);
    } catch {
      // The hook surfaces operation errors via its error banner
    }
  };

  return (
    <>
      <input
        ref={(el) => {
          inputRef.current = el;
          // Not in the standard TS DOM lib: enables folder picking in browsers.
          el?.setAttribute('webkitdirectory', '');
        }}
        type="file"
        multiple
        className="hidden"
        accept={ALLOWED_FILE_EXTENSIONS.map((ext) => `.${ext}`).join(',')}
        onChange={handleChange}
        disabled={disabled || uploading}
      />
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => inputRef.current?.click()}
        disabled={disabled || uploading}
        className="text-xs h-8"
        title="Upload a folder, preserving its structure"
      >
        {uploading ? (
          <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
        ) : (
          <FolderUp className="h-3.5 w-3.5 mr-1" />
        )}
        {uploading ? 'Uploading...' : 'Upload Folder'}
      </Button>
    </>
  );
};
