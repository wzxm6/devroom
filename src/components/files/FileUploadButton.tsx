import React, { useRef } from 'react';
import { Upload, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ALLOWED_FILE_EXTENSIONS } from '@/types/projectFile';

interface FileUploadButtonProps {
  onSelect: (file: File) => Promise<void>;
  uploading: boolean;
  disabled?: boolean;
}

export const FileUploadButton: React.FC<FileUploadButtonProps> = ({
  onSelect,
  uploading,
  disabled = false,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Reset so the same file can be picked again after an error
    e.target.value = '';
    if (!file) return;
    try {
      await onSelect(file);
    } catch {
      // The hook surfaces operation errors via its error banner
    }
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept={ALLOWED_FILE_EXTENSIONS.map((ext) => `.${ext}`).join(',')}
        onChange={handleChange}
        disabled={disabled || uploading}
      />
      <Button
        type="button"
        size="sm"
        onClick={() => inputRef.current?.click()}
        disabled={disabled || uploading}
        className="text-xs h-8"
      >
        {uploading ? (
          <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
        ) : (
          <Upload className="h-3.5 w-3.5 mr-1" />
        )}
        {uploading ? 'Uploading...' : 'Upload File'}
      </Button>
    </>
  );
};
