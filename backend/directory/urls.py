from django.urls import path
from . import views

urlpatterns = [
    path("csrf/", views.csrf, name="csrf"),
    path("skills/", views.skills, name="skills"),
    path("profiles/", views.profile_list, name="profile-list"),
    path("profiles/<slug:slug>/", views.profile_detail, name="profile-detail"),
    path("profiles/<slug:slug>/contact/", views.contact_profile, name="profile-contact"),
    path("auth/register/", views.register, name="register"),
    path("auth/login/", views.login_view, name="login"),
    path("auth/logout/", views.logout_view, name="logout"),
    path("me/profile/", views.my_profile, name="my-profile"),
    path("admin/dashboard/", views.admin_dashboard, name="admin-dashboard"),
    path("admin/profiles/<int:profile_id>/", views.admin_profile, name="admin-profile"),
    path("admin/messages/<int:message_id>/read/", views.admin_message_read, name="admin-message-read"),
]
