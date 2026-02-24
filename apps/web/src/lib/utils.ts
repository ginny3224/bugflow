/**
 * Utility helpers shared across the application.
 */

type ClassValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | ClassValue[];

/**
 * Merge class names, filtering out falsy values.
 * Lightweight alternative to clsx + tailwind-merge for this project.
 * Tailwind CSS 4 handles specificity correctly without class merging.
 */
export function cn(...inputs: ClassValue[]): string {
  const classes: string[] = [];

  for (const input of inputs) {
    if (!input) continue;

    if (typeof input === 'string') {
      classes.push(input);
    } else if (typeof input === 'number') {
      classes.push(String(input));
    } else if (Array.isArray(input)) {
      const nested = cn(...input);
      if (nested) classes.push(nested);
    }
  }

  return classes.join(' ');
}
