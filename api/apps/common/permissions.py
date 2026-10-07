from rest_framework.permissions import SAFE_METHODS, BasePermission


class HasAdminRole(BasePermission):
    """Grants access to active admin users whose role is in `view.allowed_roles`.

    Views that omit `allowed_roles` accept any admin role. Views that set `write_roles` further
    limit unsafe methods (POST, PATCH, DELETE...) to those roles."""

    message = "Your role does not allow this action."

    def has_permission(self, request, view) -> bool:
        user = request.user
        if not (user and user.is_authenticated and user.is_active):
            return False
        allowed = getattr(view, "allowed_roles", None)
        if allowed is not None and user.role not in allowed:
            return False
        write_roles = getattr(view, "write_roles", None)
        return request.method in SAFE_METHODS or write_roles is None or user.role in write_roles
