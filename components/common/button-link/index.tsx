import { Button, ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface Props extends ButtonProps {
  href: string;
  isExternal?: boolean;
}

export default function ButtonLink({
  children,
  href,
  isExternal,
  className,
}: Props) {
  return (
    <Button asChild className={cn("rounded-[6px]", className)}>
      <Link
        target={isExternal ? "_blank" : "_self"}
        href={href}
        rel={isExternal ? "noreferrer noopener" : ""}
      >
        {children}
      </Link>
    </Button>
  );
}
