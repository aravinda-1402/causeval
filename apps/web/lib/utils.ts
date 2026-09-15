import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Prefix a root-relative asset path with the deployment base path.
 * Next.js rewrites `<Link>` automatically but leaves plain `<a href>` alone,
 * so files served straight out of `public/` need this.
 */
export function asset(path: string) {
  return (process.env.NEXT_PUBLIC_BASE_PATH || "") + path;
}
