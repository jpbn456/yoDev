import json
from django.contrib.auth.models import User
from django.test import TestCase
from .models import ContactMessage, Profile, Skill


class DirectoryApiTests(TestCase):
    def setUp(self):
        self.java = Skill.objects.create(name="Java", slug="java")
        self.aws = Skill.objects.create(name="AWS", slug="aws")
        self.admin = User.objects.create_superuser("admin@example.com", "admin@example.com", "secret-pass")
        for index in range(13):
            user = User.objects.create_user(f"dev{index}@example.com", password="secret-pass", first_name="Dev", last_name=f"{index:02d}")
            profile = Profile.objects.create(user=user, professional_title="Backend Developer", introduction="Presentación válida", is_published=True)
            profile.skills.add(self.java)
            if index == 0:
                profile.skills.add(self.aws)
                profile.is_owner_featured = True
                profile.save()
        self.profile = Profile.objects.first()

    def test_required_skills_exclude_and_optional_skills_rank(self):
        response = self.client.get("/api/profiles/?required_skills=java&optional_skills=aws&sort=relevance")
        data = response.json()
        self.assertEqual(data["pagination"]["total"], 13)
        self.assertTrue(data["results"][0]["isFeatured"])
        self.assertIn("aws", [skill["slug"] for skill in data["results"][0]["skills"]])

    def test_public_list_is_paginated(self):
        response = self.client.get("/api/profiles/?page=2&page_size=12")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["pagination"]["pages"], 2)
        self.assertEqual(len(response.json()["results"]), 1)

    def test_contact_form_stores_message_without_exposing_recipient_email(self):
        response = self.client.post(f"/api/profiles/{self.profile.slug}/contact/", data=json.dumps({"name": "Recruiter", "email": "recruiter@example.com", "message": "Hablemos", "website": ""}), content_type="application/json")
        self.assertEqual(response.status_code, 201)
        self.assertEqual(ContactMessage.objects.count(), 1)

    def test_dashboard_requires_staff_and_staff_can_review(self):
        self.assertEqual(self.client.get("/api/admin/dashboard/").status_code, 401)
        self.client.force_login(self.admin)
        response = self.client.get("/api/admin/dashboard/")
        self.assertEqual(response.status_code, 200)
        review = self.client.post(f"/api/admin/profiles/{self.profile.id}/")
        self.assertEqual(review.status_code, 200)
        self.assertTrue(Profile.objects.get(pk=self.profile.id).is_reviewed)

    def test_public_profile_hides_private_contact_and_owner_can_edit_it(self):
        self.profile.email = "private@example.com"
        self.profile.visible_contacts = []
        self.profile.save()
        public = self.client.get(f"/api/profiles/{self.profile.slug}/").json()
        self.assertIsNone(public["contacts"]["email"])
        self.client.force_login(self.profile.user)
        private = self.client.get("/api/me/profile/").json()
        self.assertEqual(private["editable"]["email"], "private@example.com")

    def test_staff_can_feature_one_profile(self):
        self.client.force_login(self.admin)
        response = self.client.post(f"/api/admin/profiles/{self.profile.id}/", data=json.dumps({"isFeatured": True}), content_type="application/json")
        self.assertEqual(response.status_code, 200)
        self.assertTrue(Profile.objects.get(pk=self.profile.id).is_owner_featured)
