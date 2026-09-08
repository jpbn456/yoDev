from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("directory", "0003_contactmessage")]

    operations = [
        migrations.AlterField(
            model_name="profile",
            name="palette",
            field=models.CharField(
                choices=[
                    ("ink", "Tinta"),
                    ("ocean", "Océano"),
                    ("orchid", "Orquídea"),
                    ("moss", "Musgo"),
                    ("sunset", "Atardecer"),
                    ("terracotta", "Terracota"),
                    ("lagoon", "Laguna"),
                    ("slate", "Pizarra"),
                ],
                default="ink",
                max_length=20,
            ),
        ),
    ]
