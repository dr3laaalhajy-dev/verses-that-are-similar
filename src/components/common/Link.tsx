import React from 'react';
import { router } from '../../services/router';

export interface LinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string;
  children: React.ReactNode;
  replace?: boolean;
}

/**
 * Universal Link Component
 * Provides Next.js / SPA compatible navigation using client-side router.push
 * Prevents full page refresh, supports onClick callbacks and keeps SPA state intact
 */
export const Link: React.FC<LinkProps> = ({
  href,
  children,
  onClick,
  replace = false,
  className = '',
  ...props
}) => {
  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    // If user held Ctrl / Cmd / Shift or used middle click, allow default browser behavior (open in new tab)
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) {
      return;
    }

    e.preventDefault();

    if (onClick) {
      onClick(e);
    }

    if (replace) {
      router.replace(href);
    } else {
      router.push(href);
    }
  };

  return (
    <a
      href={href}
      onClick={handleClick}
      className={className}
      {...props}
    >
      {children}
    </a>
  );
};

export default Link;

