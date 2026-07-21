import * as React from "react";

import { cn } from "@/lib/utils";
import { useTheme } from "@/contexts/ThemeContext";

const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, style, ...props }, ref) => {
    const { isLight } = useTheme();
    return (
      <div
        ref={ref}
        className={cn(
          "rounded-2xl text-card-foreground",
          className,
        )}
        style={{
          background: isLight
            ? "linear-gradient(135deg,#ffffff 0%,#f5f6f8 100%)"
            : "linear-gradient(160deg, #14141b 0%, #0b0b10 100%)",
          backdropFilter: isLight ? "none" : "blur(10px) saturate(140%)",
          WebkitBackdropFilter: isLight ? "none" : "blur(10px) saturate(140%)",
          border: isLight ? "1px solid rgba(0,0,0,0.08)" : "1px solid rgba(255, 192, 0, 0.20)",
          boxShadow: isLight
            ? "0 1px 6px rgba(0,0,0,0.07)"
            : "0 0 0 1px rgba(255, 192, 0, 0.06) inset, 0 8px 32px rgba(0, 0, 0, 0.40)",
          ...style,
        }}
        {...props}
      />
    );
  },
);
Card.displayName = "Card";

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex flex-col space-y-1.5 p-6", className)} {...props} />
  ),
);
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("font-semibold leading-none tracking-tight", className)}
      {...props}
    />
  ),
);
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />
  ),
);
CardDescription.displayName = "CardDescription";

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
  ),
);
CardContent.displayName = "CardContent";

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex items-center p-6 pt-0", className)} {...props} />
  ),
);
CardFooter.displayName = "CardFooter";

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent };
