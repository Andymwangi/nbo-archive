from django.contrib import admin

from apps.accounts.models import AdminUser, MagicLinkToken


@admin.register(AdminUser)
class AdminUserAdmin(admin.ModelAdmin):
    list_display = ["email", "name", "role", "is_active", "last_login", "created_at"]
    list_filter = ["role", "is_active"]
    search_fields = ["email", "name"]
    readonly_fields = ["last_login", "created_at", "updated_at"]
    exclude = ["password", "groups", "user_permissions"]


@admin.register(MagicLinkToken)
class MagicLinkTokenAdmin(admin.ModelAdmin):
    list_display = ["user", "created_at", "expires_at", "used_at", "requested_ip"]
    readonly_fields = [f.name for f in MagicLinkToken._meta.fields]

    def has_add_permission(self, request):
        return False
