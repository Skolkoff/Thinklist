from app.db.base import Base

# Импортирует все модели (все классы объявлены в user.py)
from app.models.user import (  # noqa: F401
    User,
    Source,
    Paper,
    Tag,
    PaperTag,
    UserInterest,
    Event,
    Collection,
    CollectionItem,
    ArticleComment,
    CommentReaction,
    EventType,
    IngestionRun,
    Chat,
    ChatParticipant,
    Message,
    MessageReaction,
    UserBlock,
)

