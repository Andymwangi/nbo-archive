from django.core.management.base import BaseCommand, CommandError

from apps.accounts.models import AdminRole, AdminUser


class Command(BaseCommand):
    help = "Create the first owner account. The owner signs in through a magic link."

    def add_arguments(self, parser):
        parser.add_argument("--email", required=True)
        parser.add_argument("--name", required=True)

    def handle(self, *args, email: str, name: str, **options):
        if AdminUser.objects.filter(email__iexact=email).exists():
            raise CommandError(f"An admin with email {email} already exists.")
        user = AdminUser.objects.create_user(
            email=email, name=name, role=AdminRole.OWNER, is_staff=True
        )
        self.stdout.write(self.style.SUCCESS(f"Owner {user.email} created."))
