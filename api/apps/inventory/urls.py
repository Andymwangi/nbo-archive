from django.urls import path

from apps.inventory import views

urlpatterns = [
    path("holds/", views.HoldListCreateView.as_view(), name="holds"),
    path("holds/<int:pk>/", views.HoldDetailView.as_view(), name="hold-detail"),
    path(
        "admin/accessions/<int:pk>/release-hold/",
        views.AdminReleaseHoldView.as_view(),
        name="admin-accession-release-hold",
    ),
]
