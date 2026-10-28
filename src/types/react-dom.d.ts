declare module 'react-dom' {
  import * as React from 'react';

  export function createPortal(
    children: React.ReactNode,
    container: Element | DocumentFragment,
    key?: null | string
  ): React.ReactPortal;

  export function render(
    element: React.ReactNode,
    container: Element | DocumentFragment | null,
    callback?: () => void
  ): void;

  export function unmountComponentAtNode(container: Element): boolean;
  export function findDOMNode(instance: React.ReactInstance | null | undefined): Element | null | Text;
  export const version: string;
}

declare module 'react-dom/client' {
  import * as React from 'react';

  export interface Root {
    render(children: React.ReactNode): void;
    unmount(): void;
  }

  export function createRoot(container: Element | DocumentFragment, options?: any): Root;
  export function hydrateRoot(container: Element | DocumentFragment, initialChildren: React.ReactNode, options?: any): Root;
}
