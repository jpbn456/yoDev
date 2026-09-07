import json
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.models import User
from django.core.cache import cache
from django.core.paginator import Paginator
from django.db.models import F, Q
from django.http import JsonResponse
from django.middleware.csrf import get_token
from django.views.decorators.http import require_GET, require_http_methods
from .models import ContactMessage, Profile, Skill
from .mailer import send_contact_notification


def body(request):
    try:
        return json.loads(request.body or "{}")
    except json.JSONDecodeError:
        return None


def error(message, status=400):
    return JsonResponse({"detail": message}, status=status)


def serialize(profile, detail=False, include_private=False):
    location = ", ".join(part for part in (profile.city, profile.region, profile.country) if part)
    data = {
        "id": profile.id,
        "slug": profile.slug,
        "firstName": profile.user.first_name,
        "lastName": profile.user.last_name,
        "title": profile.professional_title,
        "location": location or None,
        "workModes": profile.work_modes,
        "skills": [{"name": skill.name, "slug": skill.slug} for skill in profile.skills.all()],
        "style": {"palette": profile.palette, "font": profile.font, "layout": profile.layout, "alignment": profile.alignment},
        "contacts": {
            "email": profile.email if include_private or "email" in profile.visible_contacts else None,
            "linkedin": profile.linkedin_url if include_private or "linkedin" in profile.visible_contacts else None,
        },
        "isReviewed": profile.is_reviewed,
        "isFeatured": profile.is_owner_featured,
    }
    if detail:
        data.update({"introduction": profile.introduction, "portfolio": profile.portfolio_url, "country": profile.country, "region": profile.region, "city": profile.city})
    if include_private:
        data["editable"] = {
            "firstName": profile.user.first_name,
            "lastName": profile.user.last_name,
            "email": profile.email,
            "linkedin": profile.linkedin_url,
            "visibleContacts": profile.visible_contacts,
            "workModes": profile.work_modes,
            "skills": list(profile.skills.values_list("slug", flat=True)),
            "isPublished": profile.is_published,
        }
        data["isAdmin"] = profile.user.is_staff
    return data


def serialize_admin(profile):
    data = serialize(profile, detail=True, include_private=True)
    data.update({"updatedAt": profile.updated_at.isoformat(), "needsReviewAttention": profile.needs_review_attention})
    return data


def paginate(items, request, page_size=12):
    try:
        requested_size = int(request.GET.get("page_size", page_size))
    except ValueError:
        requested_size = page_size
    paginator = Paginator(items, max(1, min(requested_size, 24)))
    page = paginator.get_page(request.GET.get("page", 1))
    return page, {"page": page.number, "pageSize": paginator.per_page, "pages": paginator.num_pages, "total": paginator.count, "hasNext": page.has_next(), "hasPrevious": page.has_previous()}


def staff_required_json(view):
    def wrapped(request, *args, **kwargs):
        if not request.user.is_authenticated:
            return error("Iniciá sesión para acceder al panel.", 401)
        if not request.user.is_staff:
            return error("No tenés permiso para acceder al panel.", 403)
        return view(request, *args, **kwargs)
    return wrapped


@require_GET
def csrf(request):
    return JsonResponse({"csrfToken": get_token(request)})


@require_GET
def skills(request):
    return JsonResponse({"results": [{"name": skill.name, "slug": skill.slug} for skill in Skill.objects.all()]})


@require_GET
def profile_list(request):
    required = [item for item in request.GET.get("required_skills", "").split(",") if item]
    optional = [item for item in request.GET.get("optional_skills", "").split(",") if item]
    queryset = Profile.objects.filter(is_published=True).select_related("user").prefetch_related("skills")
    for skill in required:
        queryset = queryset.filter(skills__slug=skill)
    if request.GET.get("country"):
        queryset = queryset.filter(country__iexact=request.GET["country"])
    if request.GET.get("region"):
        queryset = queryset.filter(region__iexact=request.GET["region"])
    if request.GET.get("city"):
        queryset = queryset.filter(city__iexact=request.GET["city"])
    modes = [item for item in request.GET.get("work_modes", "").split(",") if item]
    if modes:
        mode_query = Q()
        for mode in modes:
            mode_query |= Q(work_modes__contains=[mode])
        queryset = queryset.filter(mode_query)
    queryset = queryset.distinct()
    sort = request.GET.get("sort", "last_name")
    profiles = list(queryset)
    if sort == "relevance" and optional:
        profiles.sort(key=lambda profile: (-sum(skill.slug in optional for skill in profile.skills.all()), profile.user.last_name.lower(), profile.user.first_name.lower()))
    else:
        profiles.sort(key=lambda profile: (profile.user.last_name.lower(), profile.user.first_name.lower()))
    profiles.sort(key=lambda profile: 0 if profile.is_owner_featured else 1)
    page, pagination = paginate(profiles, request)
    return JsonResponse({"results": [serialize(profile) for profile in page.object_list], "pagination": pagination})


@require_GET
def profile_detail(request, slug):
    try:
        profile = Profile.objects.select_related("user").prefetch_related("skills").get(slug=slug, is_published=True)
    except Profile.DoesNotExist:
        return error("Perfil no encontrado.", 404)
    return JsonResponse(serialize(profile, detail=True))


@require_http_methods(["POST"])
def contact_profile(request, slug):
    data = body(request)
    if data is None:
        return error("El cuerpo debe ser JSON válido.")
    if data.get("website"):
        return error("No pudimos enviar el mensaje.")
    try:
        profile = Profile.objects.get(slug=slug, is_published=True)
    except Profile.DoesNotExist:
        return error("Perfil no encontrado.", 404)
    sender_name = data.get("name", "").strip()
    sender_email = data.get("email", "").strip().lower()
    message = data.get("message", "").strip()
    if not sender_name or not sender_email or not message:
        return error("Nombre, correo y mensaje son obligatorios.")
    if len(message) > 2_000:
        return error("El mensaje no puede superar los 2000 caracteres.")
    rate_key = f"contact:{request.META.get('REMOTE_ADDR', 'unknown')}"
    if cache.get(rate_key):
        return error("Esperá unos minutos antes de enviar otro mensaje.", 429)
    ContactMessage.objects.create(recipient=profile, sender_name=sender_name, sender_email=sender_email, message=message)
    if profile.email:
        send_contact_notification(recipient=profile.email, sender_name=sender_name, sender_email=sender_email, message=message)
    cache.set(rate_key, True, 300)
    return JsonResponse({"detail": "Tu mensaje fue enviado."}, status=201)


@require_http_methods(["POST"])
def register(request):
    data = body(request)
    if data is None:
        return error("El cuerpo debe ser JSON válido.")
    required = ("firstName", "lastName", "email", "password")
    if any(not data.get(field, "").strip() for field in required):
        return error("Nombre, apellido, correo y contraseña son obligatorios.")
    if User.objects.filter(username=data["email"].lower()).exists():
        return error("Ya existe una cuenta con ese correo.")
    user = User.objects.create_user(username=data["email"].lower(), email=data["email"].lower(), password=data["password"], first_name=data["firstName"].strip(), last_name=data["lastName"].strip())
    Profile.objects.create(user=user, professional_title="Developer", introduction="", email=user.email)
    login(request, user)
    return JsonResponse({"id": user.id, "email": user.email}, status=201)


@require_http_methods(["POST"])
def login_view(request):
    data = body(request) or {}
    user = authenticate(request, username=data.get("email", "").lower(), password=data.get("password", ""))
    if not user:
        return error("Correo o contraseña incorrectos.", 401)
    login(request, user)
    return JsonResponse({"id": user.id, "email": user.email})


@require_http_methods(["POST"])
def logout_view(request):
    logout(request)
    return JsonResponse({}, status=204)


@require_http_methods(["GET", "PUT", "DELETE"])
def my_profile(request):
    if not request.user.is_authenticated:
        return error("Iniciá sesión para gestionar tu perfil.", 401)
    profile, _ = Profile.objects.get_or_create(user=request.user, defaults={"professional_title": "Developer", "introduction": "", "email": request.user.email})
    if request.method == "GET":
        return JsonResponse(serialize(profile, detail=True, include_private=True))
    if request.method == "DELETE":
        profile.delete()
        return JsonResponse({}, status=204)
    data = body(request)
    if data is None:
        return error("El cuerpo debe ser JSON válido.")
    first_name = data.get("firstName", request.user.first_name).strip()
    last_name = data.get("lastName", request.user.last_name).strip()
    if not first_name or not last_name:
        return error("Nombre y apellido son obligatorios.")
    request.user.first_name = first_name
    request.user.last_name = last_name
    request.user.save(update_fields=["first_name", "last_name"])
    profile.professional_title = data.get("title", profile.professional_title).strip()
    profile.introduction = data.get("introduction", profile.introduction).strip()
    profile.email = data.get("email", profile.email).strip()
    profile.linkedin_url = data.get("linkedin", profile.linkedin_url).strip()
    profile.portfolio_url = data.get("portfolio", profile.portfolio_url).strip()
    profile.country = data.get("country", profile.country).strip()
    profile.region = data.get("region", profile.region).strip()
    profile.city = data.get("city", profile.city).strip()
    profile.visible_contacts = [item for item in data.get("visibleContacts", profile.visible_contacts) if item in {"email", "linkedin"}]
    profile.work_modes = [item for item in data.get("workModes", profile.work_modes) if item in {"remote", "hybrid", "onsite"}]
    style = data.get("style", {})
    for field, valid in (("palette", {choice for choice, _ in Profile.Palette.choices}), ("font", {choice for choice, _ in Profile.Font.choices}), ("layout", {choice for choice, _ in Profile.Layout.choices}), ("alignment", {"left", "center"})):
        if style.get(field) in valid:
            setattr(profile, field, style[field])
    requested_publication = bool(data.get("isPublished", profile.is_published))
    if requested_publication and (not profile.professional_title or not profile.introduction):
        return error("Completá título y presentación antes de publicar el perfil.")
    profile.is_published = requested_publication
    profile.save()
    if "skills" in data:
        profile.skills.set(Skill.objects.filter(slug__in=data["skills"]))
    return JsonResponse(serialize(profile, detail=True, include_private=True))


@require_GET
@staff_required_json
def admin_dashboard(request):
    profiles = Profile.objects.select_related("user").prefetch_related("skills")
    review = request.GET.get("review")
    if review == "pending":
        profiles = profiles.filter(is_reviewed=False)
    elif review == "changed":
        profiles = profiles.filter(is_reviewed=True, updated_at__gt=F("reviewed_at"))
    page, pagination = paginate(profiles.order_by("-updated_at"), request, page_size=20)
    messages = ContactMessage.objects.select_related("recipient__user").all()
    return JsonResponse({
        "profiles": [serialize_admin(profile) for profile in page.object_list],
        "pagination": pagination,
        "summary": {"pendingReview": Profile.objects.filter(is_reviewed=False).count(), "unreadMessages": messages.filter(is_read=False).count(), "published": Profile.objects.filter(is_published=True).count()},
        "messages": [{"id": message.id, "recipient": message.recipient.user.get_full_name(), "senderName": message.sender_name, "senderEmail": message.sender_email, "message": message.message, "isRead": message.is_read, "createdAt": message.created_at.isoformat()} for message in messages[:20]],
    })


@require_http_methods(["POST", "DELETE"])
@staff_required_json
def admin_profile(request, profile_id):
    try:
        profile = Profile.objects.get(pk=profile_id)
    except Profile.DoesNotExist:
        return error("Perfil no encontrado.", 404)
    if request.method == "DELETE":
        profile.delete()
        return JsonResponse({}, status=204)
    data = body(request) or {}
    if "isFeatured" in data:
        profile.is_owner_featured = bool(data["isFeatured"])
    profile.is_reviewed = True
    from django.utils import timezone
    profile.reviewed_at = timezone.now()
    profile.save(update_fields=["is_reviewed", "is_owner_featured", "reviewed_at", "updated_at"])
    return JsonResponse(serialize_admin(profile))


@require_http_methods(["POST"])
@staff_required_json
def admin_message_read(request, message_id):
    try:
        message = ContactMessage.objects.get(pk=message_id)
    except ContactMessage.DoesNotExist:
        return error("Mensaje no encontrado.", 404)
    message.is_read = True
    message.save(update_fields=["is_read"])
    return JsonResponse({"id": message.id, "isRead": True})
