from django.urls import path

from apps.accounts import views

urlpatterns = [
    path("magic-link/", views.MagicLinkRequestView.as_view(), name="auth-magic-link"),
    path("magic-link/verify/", views.MagicLinkVerifyView.as_view(), name="auth-magic-link-verify"),
    path("refresh/", views.RefreshView.as_view(), name="auth-refresh"),
    path("logout/", views.LogoutView.as_view(), name="auth-logout"),
    path("me/", views.MeView.as_view(), name="auth-me"),
    path("users/", views.AdminUserListCreateView.as_view(), name="admin-users"),
    path("users/<int:pk>/", views.AdminUserDetailView.as_view(), name="admin-user-detail"),
]
