import { z } from "zod";

export const adminRoleSchema = z.enum(["owner", "editor", "packer"]);
export type AdminRole = z.infer<typeof adminRoleSchema>;

export const adminUserSchema = z.object({
  id: z.number().int(),
  email: z.string().email(),
  name: z.string(),
  phone: z.string(),
  role: adminRoleSchema,
  is_active: z.boolean(),
  last_login: z.string().nullable(),
  created_at: z.string(),
});
export type AdminUser = z.infer<typeof adminUserSchema>;

export const tokenPairSchema = z.object({
  access: z.string(),
  refresh: z.string(),
  user: adminUserSchema,
});

export const accessTokenSchema = z.object({ access: z.string() });

export const detailSchema = z.object({ detail: z.string() });

export function paginatedSchema<T extends z.ZodTypeAny>(item: T) {
  return z.object({
    count: z.number().int(),
    next: z.string().nullable(),
    previous: z.string().nullable(),
    results: z.array(item),
  });
}
