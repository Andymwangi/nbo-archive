from django.urls import path

from apps.customers import views

urlpatterns = [
    path("customers/sign-in/", views.RequestCodeView.as_view(), name="customer-sign-in"),
    path(
        "customers/sign-in/verify/",
        views.VerifyCodeView.as_view(),
        name="customer-sign-in-verify",
    ),
    path("customers/me/", views.MeView.as_view(), name="customer-me"),
    path("customers/sign-out/", views.SignOutView.as_view(), name="customer-sign-out"),
]
