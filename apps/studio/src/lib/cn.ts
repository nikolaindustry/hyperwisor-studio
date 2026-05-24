/** Tiny class joiner — same idea as clsx, no dep. */
export function cn(...inputs: Array<string | undefined | null | false>): string {
  return inputs.filter(Boolean).join(" ");
}
