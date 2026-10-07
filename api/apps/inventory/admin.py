from django.contrib import admin

from apps.inventory.models import Hold


@admin.register(Hold)
class HoldAdmin(admin.ModelAdmin):
    """Read-only: holds change only through the hold service, which keeps the piece's status in
    step with the hold."""

    list_display = ["accession", "status", "expires_at", "ended_at", "created_at"]
    list_filter = ["status"]
    search_fields = ["accession__number"]
    readonly_fields = [f.name for f in Hold._meta.fields]

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
