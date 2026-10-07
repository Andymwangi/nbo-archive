from django.db import migrations

SEQUENCES = ("accession", "drop")


def create_sequences(apps, schema_editor):
    Sequence = apps.get_model("catalog", "Sequence")
    for name in SEQUENCES:
        Sequence.objects.get_or_create(name=name, defaults={"last_value": 0})


def remove_sequences(apps, schema_editor):
    apps.get_model("catalog", "Sequence").objects.filter(name__in=SEQUENCES).delete()


class Migration(migrations.Migration):
    dependencies = [
        ("catalog", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(create_sequences, remove_sequences),
    ]
