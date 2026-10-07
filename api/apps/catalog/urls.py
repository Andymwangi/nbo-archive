from django.urls import path

from apps.catalog import views

urlpatterns = [
    path("catalog/accessions/", views.PublicAccessionListView.as_view(), name="catalog-list"),
    path(
        "catalog/accessions/<str:archive_no>/",
        views.PublicAccessionDetailView.as_view(),
        name="catalog-detail",
    ),
    path("catalog/facets/", views.FacetsView.as_view(), name="catalog-facets"),
    path("catalog/pulse/", views.PulseView.as_view(), name="catalog-pulse"),
    path("catalog/drops/", views.PublicDropListView.as_view(), name="catalog-drops"),
    path(
        "catalog/drops/<int:number>/",
        views.PublicDropDetailView.as_view(),
        name="catalog-drop-detail",
    ),
    path(
        "admin/accessions/",
        views.AdminAccessionListCreateView.as_view(),
        name="admin-accessions",
    ),
    path(
        "admin/accessions/<int:pk>/",
        views.AdminAccessionDetailView.as_view(),
        name="admin-accession-detail",
    ),
    path(
        "admin/accessions/<int:pk>/publish/",
        views.AdminAccessionPublishView.as_view(),
        name="admin-accession-publish",
    ),
    path(
        "admin/accessions/<int:pk>/schedule/",
        views.AdminAccessionScheduleView.as_view(),
        name="admin-accession-schedule",
    ),
    path(
        "admin/accessions/<int:pk>/withdraw/",
        views.AdminAccessionWithdrawView.as_view(),
        name="admin-accession-withdraw",
    ),
    path(
        "admin/accessions/<int:pk>/images/",
        views.AdminImageCreateView.as_view(),
        name="admin-accession-images",
    ),
    path(
        "admin/accessions/<int:pk>/images/order/",
        views.AdminImageOrderView.as_view(),
        name="admin-accession-image-order",
    ),
    path(
        "admin/accessions/<int:pk>/images/<int:image_id>/",
        views.AdminImageDetailView.as_view(),
        name="admin-accession-image-detail",
    ),
    path(
        "admin/accessions/<int:pk>/flaws/",
        views.AdminFlawCreateView.as_view(),
        name="admin-accession-flaws",
    ),
    path(
        "admin/accessions/<int:pk>/flaws/<int:flaw_id>/",
        views.AdminFlawDetailView.as_view(),
        name="admin-accession-flaw-detail",
    ),
    path("admin/drops/", views.AdminDropListCreateView.as_view(), name="admin-drops"),
    path("admin/drops/<int:pk>/", views.AdminDropDetailView.as_view(), name="admin-drop-detail"),
    path(
        "admin/drops/<int:pk>/schedule/",
        views.AdminDropScheduleView.as_view(),
        name="admin-drop-schedule",
    ),
    path(
        "admin/drops/<int:pk>/release/",
        views.AdminDropReleaseView.as_view(),
        name="admin-drop-release",
    ),
]
