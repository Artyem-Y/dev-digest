export type RequestScope = { workspaceId: string; userId: string };

export function requireScope(request: { scope?: RequestScope }): RequestScope {
  if (!request.scope) throw new Error('missing scope');
  return request.scope;
}
