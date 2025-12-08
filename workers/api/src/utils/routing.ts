export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE' | 'OPTIONS';

export interface Route {
  path: string;
  method: HttpMethod;
  handler: (
    request: Request,
    params: Record<string, string>,
  ) => Promise<Response>;
}

export class Router {
  private routes: Route[] = [];

  add(route: Route): void {
    this.routes.push(route);
  }

  addRoutes(routes: Route[]): void {
    this.routes.push(...routes);
  }

  async match(
    pathname: string,
    method: HttpMethod,
  ): Promise<{ handler: Route['handler']; params: Record<string, string> } | null> {
    for (const route of this.routes) {
      if (route.method !== method && route.method !== 'OPTIONS') {
        continue;
      }

      const params = this.matchPath(route.path, pathname);
      if (params !== null) {
        return { handler: route.handler, params };
      }
    }
    return null;
  }

  private matchPath(
    pattern: string,
    pathname: string,
  ): Record<string, string> | null {
    const patternParts = pattern.split('/').filter(Boolean);
    const pathParts = pathname.split('/').filter(Boolean);

    if (patternParts.length !== pathParts.length) {
      return null;
    }

    const params: Record<string, string> = {};
    for (let i = 0; i < patternParts.length; i++) {
      const patternPart = patternParts[i];
      const pathPart = pathParts[i];

      if (patternPart.startsWith(':')) {
        const paramName = patternPart.slice(1);
        params[paramName] = decodeURIComponent(pathPart);
      } else if (patternPart !== pathPart) {
        return null;
      }
    }

    return params;
  }
}

export function createRouter(): Router {
  return new Router();
}

