import { useState, useEffect } from 'react';

export type Breakpoint = 'sm' | 'md' | 'lg' | 'xl' | '2xl';

const breakpoints: Record<Breakpoint, number> = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
};

export interface BreakpointState {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isBelow: (breakpoint: Breakpoint) => boolean;
  isAbove: (breakpoint: Breakpoint) => boolean;
  current: Breakpoint | null;
}

export const useBreakpoint = (): BreakpointState => {
  const [width, setWidth] = useState(() => {
    if (typeof window === 'undefined') return 0;
    return window.innerWidth;
  });

  useEffect(() => {
    const handleResize = () => {
      setWidth(window.innerWidth);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const getCurrentBreakpoint = (): Breakpoint | null => {
    if (width >= breakpoints['2xl']) return '2xl';
    if (width >= breakpoints.xl) return 'xl';
    if (width >= breakpoints.lg) return 'lg';
    if (width >= breakpoints.md) return 'md';
    if (width >= breakpoints.sm) return 'sm';
    return null;
  };

  const isBelow = (breakpoint: Breakpoint): boolean => {
    return width < breakpoints[breakpoint];
  };

  const isAbove = (breakpoint: Breakpoint): boolean => {
    return width >= breakpoints[breakpoint];
  };

  const current = getCurrentBreakpoint();

  return {
    isMobile: width < breakpoints.md,
    isTablet: width >= breakpoints.md && width < breakpoints.lg,
    isDesktop: width >= breakpoints.lg,
    isBelow,
    isAbove,
    current,
  };
};

