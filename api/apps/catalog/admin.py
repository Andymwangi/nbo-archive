from django.contrib import admin

from apps.catalog.models import Accession, AccessionImage, Drop, Flaw, Sequence


class ReadOnlyAdminMixin:
    """Catalogue writes go through apps.catalog.services, which strips photo metadata, enforces
    the publishing rules and takes the row locks. The Django admin is for inspection only."""

    def has_add_permission(self, request, obj=None):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


class AccessionImageInline(ReadOnlyAdminMixin, admin.TabularInline):
    model = AccessionImage
    extra = 0
    fields = ["kind", "file", "width", "height", "alt_text", "position"]


class FlawInline(ReadOnlyAdminMixin, admin.TabularInline):
    model = Flaw
    extra = 0
    fields = ["description", "image", "position"]


@admin.register(Accession)
class AccessionAdmin(ReadOnlyAdminMixin, admin.ModelAdmin):
    list_display = ["archive_no", "title", "category", "status", "price_kes", "published_at"]
    list_filter = ["status", "category", "condition_grade", "is_placeholder"]
    search_fields = ["title", "brand", "number"]
    inlines = [AccessionImageInline, FlawInline]


@admin.register(Drop)
class DropAdmin(ReadOnlyAdminMixin, admin.ModelAdmin):
    list_display = ["number", "title", "status", "release_at"]
    list_filter = ["status"]


@admin.register(Sequence)
class SequenceAdmin(ReadOnlyAdminMixin, admin.ModelAdmin):
    list_display = ["name", "last_value", "updated_at"]
