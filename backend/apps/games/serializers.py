from rest_framework import serializers

from .models import Game, Score


class GameSerializer(serializers.ModelSerializer):
    class Meta:
        model = Game
        fields = ["id", "slug", "name", "description", "is_enabled", "max_score_rate", "order"]


class PublicGameSerializer(serializers.ModelSerializer):
    class Meta:
        model = Game
        fields = ["slug", "name", "description"]


class LeaderboardEntrySerializer(serializers.ModelSerializer):
    class Meta:
        model = Score
        fields = ["nickname", "score", "duration_ms", "created_at"]


class ScoreSubmitSerializer(serializers.Serializer):
    token = serializers.CharField()
    nickname = serializers.RegexField(
        r"^[\w .\-]{2,24}$",
        error_messages={"invalid": "2-24 letters, numbers, spaces, dots, dashes or underscores."},
    )
    score = serializers.IntegerField(min_value=0, max_value=10_000_000)
    duration_ms = serializers.IntegerField(min_value=0, max_value=3 * 60 * 60 * 1000)


class ScoreAdminSerializer(serializers.ModelSerializer):
    game = serializers.SlugRelatedField(slug_field="slug", read_only=True)

    class Meta:
        model = Score
        fields = ["id", "game", "nickname", "score", "duration_ms", "is_hidden", "created_at"]
        read_only_fields = ["game", "nickname", "score", "duration_ms", "created_at"]
