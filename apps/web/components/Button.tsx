import Link from "next/link";
import type { ComponentPropsWithoutRef, ReactNode } from "react";

type Variant = "primary" | "ghost" | "cream";

const variantClass: Record<Variant, string> = {
  primary: "btn",
  ghost: "btn btn-ghost",
  cream: "btn btn-cream",
};

type CommonProps = {
  variant?: Variant;
  className?: string;
  children: ReactNode;
};

type LinkButtonProps = CommonProps & { href: string } & Omit<
  ComponentPropsWithoutRef<typeof Link>,
  "href" | "className" | "children"
>;

type NativeButtonProps = CommonProps & { href?: undefined } & Omit<
  ComponentPropsWithoutRef<"button">,
  "className" | "children"
>;

export function Button(props: LinkButtonProps | NativeButtonProps) {
  const { variant = "primary", className, children } = props;
  const cls = [variantClass[variant], className].filter(Boolean).join(" ");

  if ("href" in props && props.href) {
    const { variant: _v, className: _c, children: _ch, href, ...rest } = props;
    return (
      <Link href={href} className={cls} {...rest}>
        {children}
      </Link>
    );
  }

  const { variant: _v, className: _c, children: _ch, ...rest } = props as NativeButtonProps;
  return (
    <button type="button" className={cls} {...rest}>
      {children}
    </button>
  );
}
