export const ROLES = [
  "superadmin",
  "inventory_manager",
  "order_manager",
  "viewer",
  "custom",
] as const;

export type AdminRole = (typeof ROLES)[number];

export const PERMISSIONS = [
  "users:read",
  "users:manage",
  "roles:manage",
  "products:read",
  "products:write",
  "products:delete",
  "inventory:read",
  "inventory:adjust",
  "orders:read",
  "orders:manage",
  "orders:refund",
  "analytics:read",
  "settings:manage",
  "audit:read",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const ROLE_PERMISSIONS: Record<AdminRole, Permission[]> = {
  superadmin: [...PERMISSIONS],
  inventory_manager: [
    "products:read",
    "products:write",
    "inventory:read",
    "inventory:adjust",
  ],
  order_manager: [
    "orders:read",
    "orders:manage",
    "analytics:read",
  ],
  viewer: [
    "products:read",
    "inventory:read",
    "orders:read",
    "analytics:read",
  ],
  custom: [],
};

export function getEffectivePermissions(
  role: string,
  extraPermissions: string[] = [],
): Permission[] {
  const validSet = new Set<string>(PERMISSIONS);

  if (role === "superadmin") {
    return [...PERMISSIONS];
  }

  const base =
    ROLE_PERMISSIONS[role as AdminRole] !== undefined
      ? ROLE_PERMISSIONS[role as AdminRole]
      : [];

  const extras = extraPermissions.filter((p): p is Permission =>
    validSet.has(p),
  );

  return Array.from(new Set<Permission>([...base, ...extras]));
}

export function hasPermission(
  permissions: readonly string[] | undefined | null,
  required: Permission,
): boolean {
  if (!permissions || permissions.length === 0) return false;
  return permissions.includes(required);
}

export function hasAnyPermission(
  permissions: readonly string[] | undefined | null,
  requiredList: readonly Permission[],
): boolean {
  if (!permissions || permissions.length === 0 || requiredList.length === 0) {
    return false;
  }
  return requiredList.some((perm) => permissions.includes(perm));
}