from django.contrib import admin
from django.utils import timezone
from .models import ContactMessage, Profile, Skill


@admin.action(description="Marcar perfiles seleccionados como revisados")
def mark_reviewed(modeladmin, request, queryset):
    queryset.update(is_reviewed=True, reviewed_at=timezone.now())


@admin.register(Profile)
class ProfileAdmin(admin.ModelAdmin):
    list_display = ("full_name", "professional_title", "is_owner_featured", "is_published", "is_reviewed", "needs_review_attention", "updated_at")
    list_filter = ("is_owner_featured", "is_published", "is_reviewed", "palette", "layout")
    search_fields = ("user__first_name", "user__last_name", "professional_title", "country", "city")
    filter_horizontal = ("skills",)
    actions = (mark_reviewed,)

    @admin.display(ordering="user__last_name", description="Nombre")
    def full_name(self, obj):
        return obj.user.get_full_name()


@admin.register(Skill)
class SkillAdmin(admin.ModelAdmin):
    list_display = ("name", "slug")
    search_fields = ("name",)


@admin.register(ContactMessage)
class ContactMessageAdmin(admin.ModelAdmin):
    list_display = ("recipient", "sender_name", "sender_email", "is_read", "created_at")
    list_filter = ("is_read",)
    search_fields = ("sender_name", "sender_email", "recipient__user__first_name", "recipient__user__last_name")
    readonly_fields = ("recipient", "sender_name", "sender_email", "message", "created_at")
