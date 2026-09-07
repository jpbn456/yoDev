from django.core.management.base import BaseCommand
from directory.models import Skill


SKILLS = ["AWS", "Docker", "Django", "Git", "Java", "JavaScript", "Kubernetes", "Next.js", "Node.js", "PostgreSQL", "Python", "React", "Spring Boot", "Tailwind CSS", "TypeScript"]


class Command(BaseCommand):
    help = "Carga el catálogo inicial de habilidades sin duplicar registros."

    def handle(self, *args, **options):
        created = 0
        for name in SKILLS:
            _, was_created = Skill.objects.get_or_create(name=name)
            created += was_created
        self.stdout.write(self.style.SUCCESS(f"Habilidades creadas: {created}. Total: {Skill.objects.count()}."))
