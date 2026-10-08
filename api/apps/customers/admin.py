from django.contrib import admin

from apps.customers.models import Customer


@admin.register(Customer)
class CustomerAdmin(admin.ModelAdmin):
    list_display = ["email", "name", "phone", "email_verified_at", "last_signed_in_at"]
    search_fields = ["email", "name", "phone"]
    readonly_fields = ["email_verified_at", "last_signed_in_at", "created_at", "updated_at"]
