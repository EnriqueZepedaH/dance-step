import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  onDark?: boolean;
  bullet?: boolean;
  className?: string;
};

export function Eyebrow({ children, onDark, bullet, className }: Props) {
  const cls = [
    "eyebrow",
    onDark ? "on-dark" : "",
    bullet ? "bullet" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return <span className={cls}>{children}</span>;
}
