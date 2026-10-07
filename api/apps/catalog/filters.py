import django_filters
from django.db.models import Q

from apps.catalog.models import (
    Accession,
    AccessionStatus,
    Category,
    ChestBand,
    ConditionGrade,
)
from apps.catalog.specs import parse_archive_no

SORTS = {
    "newest": ("-published_at", "-number"),
    "price": ("price_kes", "-number"),
    "-price": ("-price_kes", "-number"),
    "number": ("number",),
    "-number": ("-number",),
}


class _TextInFilter(django_filters.BaseInFilter, django_filters.CharFilter):
    """Comma-separated values matched case-insensitively (`?brand=Lacoste,fila`)."""

    def filter(self, qs, value):
        if not value:
            return qs
        query = Q()
        for item in value:
            if item.strip():
                query |= Q(**{f"{self.field_name}__iexact": item.strip()})
        return qs.filter(query)


class PublicAccessionFilter(django_filters.FilterSet):
    category = django_filters.MultipleChoiceFilter(choices=Category.choices)
    size = django_filters.MultipleChoiceFilter(field_name="chest_band", choices=ChestBand.choices)
    condition = django_filters.MultipleChoiceFilter(
        field_name="condition_grade", choices=ConditionGrade.choices
    )
    brand = _TextInFilter(field_name="brand")
    colour = _TextInFilter(field_name="colour")
    era = _TextInFilter(field_name="era")
    drop = django_filters.NumberFilter(field_name="drop__number")
    price_min = django_filters.NumberFilter(field_name="price_kes", lookup_expr="gte")
    price_max = django_filters.NumberFilter(field_name="price_kes", lookup_expr="lte")
    include_claimed = django_filters.BooleanFilter(method="filter_include_claimed")
    sort = django_filters.ChoiceFilter(
        choices=[(key, key) for key in SORTS], method="filter_sort", empty_label=None
    )

    class Meta:
        model = Accession
        fields: list[str] = []

    @property
    def qs(self):
        queryset = super().qs
        if not self.form.cleaned_data.get("include_claimed"):
            queryset = queryset.exclude(status=AccessionStatus.CLAIMED)
        if not self.form.cleaned_data.get("sort"):
            queryset = queryset.order_by(*SORTS["newest"])
        return queryset

    def filter_include_claimed(self, queryset, name, value):
        return queryset

    def filter_sort(self, queryset, name, value):
        return queryset.order_by(*SORTS[value])


class AdminAccessionFilter(django_filters.FilterSet):
    status = django_filters.MultipleChoiceFilter(choices=AccessionStatus.choices)
    category = django_filters.MultipleChoiceFilter(choices=Category.choices)
    drop = django_filters.NumberFilter(field_name="drop__number")
    is_placeholder = django_filters.BooleanFilter()
    q = django_filters.CharFilter(method="filter_search")

    class Meta:
        model = Accession
        fields: list[str] = []

    def filter_search(self, queryset, name, value):
        value = value.strip()
        if not value:
            return queryset
        query = Q(title__icontains=value) | Q(brand__icontains=value)
        number = parse_archive_no(value)
        if number is not None:
            query |= Q(number=number)
        return queryset.filter(query)
