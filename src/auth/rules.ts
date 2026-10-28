import { UserRole, Permission, AuthUser } from './types';

/**
 * Explicit rule-based permissions matrix.
 *
 * STUDENT:
 * - Can access learning activities
 * - Can access own progress
 * - CANNOT access admin dashboard
 * - CANNOT access other students' progress or detailed history
 *
 * ADMIN:
 * - Can access admin dashboard
 * - Can view all students
 * - Can view individual student learning details
 * - Can view aggregate statistics and attempt histories
 */
export const ROLE_PERMISSIONS: Record<UserRole, readonly Permission[]> = {
  student: ['access:learning', 'access:own_progress'],
  admin: [
    'access:learning',
    'access:own_progress',
    'access:admin_dashboard',
    'view:all_students',
    'view:student_details',
    'view:student_attempts',
  ],
};

/**
 * Checks whether a given role has the requested permission.
 */
export function canRole(role: UserRole | null | undefined, permission: Permission): boolean {
  if (!role) return false;
  const permissions = ROLE_PERMISSIONS[role];
  return permissions ? permissions.includes(permission) : false;
}

/**
 * Checks whether an AuthUser has the requested permission.
 */
export function can(user: AuthUser | null | undefined, permission: Permission): boolean {
  if (!user) return false;
  return canRole(user.role, permission);
}

/**
 * Checks whether an AuthUser has a specific role.
 */
export function hasRole(user: AuthUser | null | undefined, role: UserRole): boolean {
  if (!user) return false;
  return user.role === role;
}
