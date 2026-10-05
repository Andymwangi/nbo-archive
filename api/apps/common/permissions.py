from rest_framework.permissions import BasePermission


class HasAdminRole(BasePermission):
    """Grants access to active admin users whose role is in `view.allowed_roles`.

    Views that omit `allowed_roles` accept any admin role."""

    message = "Your role does not allow this action."

    def has_permission(self, request, view) -> bool:
        user = request.user
        if not (user and user.is_authenticated and user.is_active):
            return False
        allowed = getattr(view, "allowed_roles", None)
        return allowed is None or user.role in allowed
