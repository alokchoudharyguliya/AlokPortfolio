from apps.core.viewsets import OwnerModelViewSet, OwnerSingletonView

from .models import FocusArea, Profile, ResumeVersion, SocialLink
from .serializers import (
    FocusAreaSerializer,
    ProfileSerializer,
    ResumeVersionSerializer,
    SocialLinkSerializer,
)


class ProfileAdminView(OwnerSingletonView):
    model = Profile
    serializer_class = ProfileSerializer


class SocialLinkAdminViewSet(OwnerModelViewSet):
    queryset = SocialLink.objects.all()
    serializer_class = SocialLinkSerializer


class FocusAreaAdminViewSet(OwnerModelViewSet):
    queryset = FocusArea.objects.all()
    serializer_class = FocusAreaSerializer


class ResumeVersionAdminViewSet(OwnerModelViewSet):
    queryset = ResumeVersion.objects.select_related("asset")
    serializer_class = ResumeVersionSerializer
