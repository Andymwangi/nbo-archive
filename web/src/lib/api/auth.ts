import { apiRequest } from "@/lib/api/client";
import {
  accessTokenSchema,
  type AdminRole,
  adminUserSchema,
  detailSchema,
  paginatedSchema,
  tokenPairSchema,
} from "@/lib/api/types";

export function requestMagicLink(email: string, clientIp?: string) {
  return apiRequest("/auth/magic-link/", {
    method: "POST",
    body: { email },
    clientIp,
    schema: detailSchema,
  });
}

export function verifyMagicLink(token: string, clientIp?: string) {
  return apiRequest("/auth/magic-link/verify/", {
    method: "POST",
    body: { token },
    clientIp,
    schema: tokenPairSchema,
  });
}

export function refreshAccess(refresh: string, clientIp?: string) {
  return apiRequest("/auth/refresh/", {
    method: "POST",
    body: { refresh },
    clientIp,
    schema: accessTokenSchema,
  });
}

export function logout(access: string, refresh: string) {
  return apiRequest("/auth/logout/", {
    method: "POST",
    token: access,
    body: { refresh },
    schema: detailSchema,
  });
}

export function getMe(access: string) {
  return apiRequest("/auth/me/", { token: access, schema: adminUserSchema });
}

export function listAdmins(access: string, page = 1) {
  return apiRequest("/auth/users/", {
    token: access,
    query: { page },
    schema: paginatedSchema(adminUserSchema),
  });
}

export type NewAdmin = { email: string; name: string; role: AdminRole; phone?: string };

export function createAdmin(access: string, data: NewAdmin) {
  return apiRequest("/auth/users/", {
    method: "POST",
    token: access,
    body: data,
    schema: adminUserSchema,
  });
}

export type AdminChanges = Partial<{
  name: string;
  phone: string;
  role: AdminRole;
  is_active: boolean;
}>;

export function updateAdmin(access: string, id: number, changes: AdminChanges) {
  return apiRequest(`/auth/users/${id}/`, {
    method: "PATCH",
    token: access,
    body: changes,
    schema: adminUserSchema,
  });
}
