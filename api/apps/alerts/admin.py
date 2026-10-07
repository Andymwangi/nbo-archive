from django.contrib import admin

from apps.alerts.models import DropAlertSubscriber


@admin.register(DropAlertSubscriber)
class DropAlertSubscriberAdmin(admin.ModelAdmin):
    list_display = ["phone", "email", "consented_at", "consent_version", "unsubscribed_at"]
    list_filter = ["consent_version"]
    search_fields = ["phone", "email"]
    readonly_fields = [f.name for f in DropAlertSubscriber._meta.fields]

    def has_add_permission(self, request):
        return False
