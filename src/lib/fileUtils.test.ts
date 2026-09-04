import { describe, it, expect } from 'vitest';
import {
  formatFileSize,
  getFileExtension,
  sanitizeFileName,
  sanitizePathSegment,
  encodeRelativePath,
  decodeStorageName,
  getStoredFolderPath,
  validateFile,
} from './fileUtils';
import { PROJECT_FILE_MAX_SIZE } from '@/types/projectFile';

const makeFile = (name: string, size: number, type = ''): File =>
  new File([new Uint8Array(size)], name, { type });

describe('formatFileSize', () => {
  it('formats bytes, KB, MB, and GB', () => {
    expect(formatFileSize(0)).toBe('0 B');
    expect(formatFileSize(512)).toBe('512 B');
    expect(formatFileSize(1024)).toBe('1.0 KB');
    expect(formatFileSize(1536)).toBe('1.5 KB');
    expect(formatFileSize(1024 * 1024)).toBe('1.0 MB');
    expect(formatFileSize(2.5 * 1024 * 1024 * 1024)).toBe('2.5 GB');
  });

  it('handles invalid input gracefully', () => {
    expect(formatFileSize(-1)).toBe('—');
    expect(formatFileSize(NaN)).toBe('—');
  });
});

describe('getFileExtension', () => {
  it('extracts lowercase extensions', () => {
    expect(getFileExtension('report.PDF')).toBe('pdf');
    expect(getFileExtension('archive.tar.gz')).toBe('gz');
  });

  it('returns empty for missing extensions', () => {
    expect(getFileExtension('README')).toBe('');
    expect(getFileExtension('.hidden')).toBe('');
    expect(getFileExtension('trailing.')).toBe('');
  });
});

describe('sanitizeFileName', () => {
  it('strips directory components and traversal', () => {
    expect(sanitizeFileName('../../etc/passwd')).toBe('passwd');
    expect(sanitizeFileName('a\\b\\evil.exe')).toBe('evil.exe');
  });

  it('falls back for empty names and truncates long ones', () => {
    expect(sanitizeFileName('   ')).toBe('file');
    expect(sanitizeFileName('...')).toBe('file');
    expect(sanitizeFileName(`${'a'.repeat(300)}.pdf`).length).toBeLessThanOrEqual(255);
  });
});

describe('validateFile', () => {
  it('accepts common project files', () => {
    expect(validateFile(makeFile('spec.pdf', 100, 'application/pdf'))).toBeNull();
    expect(validateFile(makeFile('notes.md', 10))).toBeNull();
    expect(validateFile(makeFile('data.csv', 10))).toBeNull();
    expect(validateFile(makeFile('photo.PNG', 10))).toBeNull();
  });

  it('rejects empty, oversized, unnamed, and unsupported files', () => {
    expect(validateFile(makeFile('empty.txt', 0))).toMatch(/empty/i);
    expect(validateFile(makeFile('huge.zip', PROJECT_FILE_MAX_SIZE + 1))).toMatch(/exceed/i);
    expect(validateFile(makeFile('   ', 10))).toMatch(/name/i);
    expect(validateFile(makeFile('run.exe', 10))).toMatch(/not supported/i);
    expect(validateFile(makeFile('noext', 10))).toMatch(/not supported/i);
  });
});

describe('sanitizePathSegment', () => {
  it('cleans without dropping directory intent', () => {
    expect(sanitizePathSegment('my docs')).toBe('my docs');
    expect(sanitizePathSegment('..')).toBe('');
    // A single segment may never contain the real delimiter.
    expect(sanitizePathSegment('a/b')).toBe('ab');
  });

  it('folds to the storage-safe alphabet', () => {
    expect(sanitizePathSegment('café')).toBe('cafe');
    expect(sanitizePathSegment('100%.pdf')).toBe('100.pdf');
    expect(sanitizePathSegment('a／b')).toBe('ab');
  });
});

describe('encodeRelativePath', () => {
  it('encodes nested folders with an ASCII-safe reversible join', () => {
    expect(encodeRelativePath('docs/spec.pdf')).toBe('docs+spec.pdf');
    expect(encodeRelativePath('a/b/c/notes.md')).toBe('a+b+c+notes.md');
  });

  it('escapes literal plus signs so decoding stays unambiguous', () => {
    // 'C++' → 'C++++', plus one separator '+': five in a row.
    expect(encodeRelativePath('C++/main.txt')).toBe('C+++++main.txt');
  });

  it('folds accented characters and drops non-latin scripts', () => {
    expect(encodeRelativePath('café/über.pdf')).toBe('cafe+uber.pdf');
    expect(encodeRelativePath('填报指南/report.pdf')).toBeNull();
  });

  it('strips storage-unsafe characters (!%?# etc.)', () => {
    expect(encodeRelativePath('100%/r#eport.pdf')).toBe('100+report.pdf');
  });

  it('rejects flat names and unsafe paths', () => {
    expect(encodeRelativePath('lonely.pdf')).toBeNull();
    expect(encodeRelativePath('')).toBeNull();
    expect(encodeRelativePath('docs/../../evil.pdf')).toBeNull();
    expect(encodeRelativePath('docs/.../x.pdf')).toBeNull();
  });

  it('rejects overlong encodings', () => {
    const deep = `${'a'.repeat(100)}/${'b'.repeat(100)}/${'c'.repeat(100)}.pdf`;
    expect(encodeRelativePath(deep)).toBeNull();
  });

  it('only ever emits the Supabase storage-safe alphabet', () => {
    const samples = [
      'My Docs (final)/100% – über #1.pdf',
      'a+b/c++d/e_f-g.h.pdf',
      'sp ace/d.o.t/semi;colon.pdf',
    ];
    for (const s of samples) {
      const encoded = encodeRelativePath(s);
      expect(encoded).not.toBeNull();
      expect(encoded as string).toMatch(/^(\w|!|-|\.|\*|'|\(|\)| |&|\$|@|=|;|:|\+|,|\?)+$/);
    }
  });
});

describe('decodeStorageName / getStoredFolderPath', () => {
  it('round-trips encoded folders including escaped separators', () => {
    expect(decodeStorageName('docs+sub+spec.pdf')).toEqual({ folders: ['docs', 'sub'], fileName: 'spec.pdf' });
    expect(decodeStorageName('C+++++main.txt')).toEqual({ folders: ['C++'], fileName: 'main.txt' });
    expect(getStoredFolderPath('ws/proj/id/docs+sub+spec.pdf')).toEqual(['docs', 'sub']);
  });

  it('treats legacy flat names as root files', () => {
    expect(decodeStorageName('plain.pdf')).toEqual({ folders: [], fileName: 'plain.pdf' });
    expect(getStoredFolderPath('ws/proj/id/plain.pdf')).toEqual([]);
  });
});
