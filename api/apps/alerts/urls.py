from django.urls import path

from apps.alerts import views

urlpatterns = [
    path("alerts/drops/", views.SubscribeView.as_view(), name="drop-alerts-subscribe"),
    path(
        "alerts/drops/unsubscribe/",
        views.UnsubscribeView.as_view(),
        name="drop-alerts-unsubscribe",
    ),
    path("admin/drop-alerts/", views.AdminSubscriberListView.as_view(), name="admin-drop-alerts"),
]
