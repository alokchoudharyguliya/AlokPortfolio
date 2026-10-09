from . import services
from .models import Version


class VersionedViewSetMixin:
    """
    Records a Version after each create / update / delete performed through a
    DRF generic view. Mix into any admin viewset whose model should have history.
    """

    def perform_create(self, serializer):
        super().perform_create(serializer)
        services.record(serializer.instance, Version.Action.CREATE, self.request.user)

    def perform_update(self, serializer):
        super().perform_update(serializer)
        services.record(serializer.instance, Version.Action.UPDATE, self.request.user)

    def perform_destroy(self, instance):
        services.record(instance, Version.Action.DELETE, self.request.user)
        super().perform_destroy(instance)
