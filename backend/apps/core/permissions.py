from rest_framework.permissions import BasePermission


class IsOwner(BasePermission):
    """
    Grants access only to the site owner ("sudo" user).

    The platform is single-owner: the owner is the superuser account. Tokens are
    only issued after the full login flow (password + TOTP when required), so a
    valid authenticated superuser here implies a completed sudo login.
    """

    message = "Sudo access required."

    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and user.is_superuser)
