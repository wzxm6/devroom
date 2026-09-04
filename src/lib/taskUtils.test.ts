import { describe, it, expect } from 'vitest';
import { getDueDateInfo, PRIORITY_CONFIG, STATUS_CONFIG } from './taskUtils';

const isoDate = (offsetDays: number): string => {
  // Local-midnight calendar date, exactly the 'YYYY-MM-DD' shape the
  // database returns and getDueDateInfo consumes (avoids UTC-shift skew).
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + offsetDays);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

describe('getDueDateInfo', () => {
  it('returns null for missing or invalid input', () => {
    expect(getDueDateInfo(null)).toBeNull();
    expect(getDueDateInfo('not-a-date')).toBeNull();
    expect(getDueDateInfo('')).toBeNull();
  });

  it('flags overdue dates with day counts', () => {
    const info = getDueDateInfo(isoDate(-3));
    expect(info?.isOverdue).toBe(true);
    expect(info?.label).toBe('Overdue by 3 days');

    const single = getDueDateInfo(isoDate(-1));
    expect(single?.label).toBe('Overdue by 1 day');
  });

  it('recognizes today and tomorrow', () => {
    expect(getDueDateInfo(isoDate(0))).toMatchObject({
      label: 'Due today',
      isOverdue: false,
      isToday: true,
      isTomorrow: false,
    });
    expect(getDueDateInfo(isoDate(1))).toMatchObject({
      label: 'Due tomorrow',
      isOverdue: false,
      isToday: false,
      isTomorrow: true,
    });
  });

  it('labels future dates with remaining days', () => {
    const info = getDueDateInfo(isoDate(5));
    expect(info?.isOverdue).toBe(false);
    expect(info?.label).toBe('Due in 5 days');
  });
});

describe('priority and status configs', () => {
  it('covers every priority and status', () => {
    expect(Object.keys(PRIORITY_CONFIG).sort()).toEqual(['HIGH', 'LOW', 'MEDIUM', 'URGENT']);
    expect(Object.keys(STATUS_CONFIG).sort()).toEqual(['DONE', 'IN_PROGRESS', 'TODO']);
  });

  it('gives every entry a human label', () => {
    for (const cfg of [...Object.values(PRIORITY_CONFIG), ...Object.values(STATUS_CONFIG)]) {
      expect(cfg.label.length).toBeGreaterThan(0);
    }
  });
});
