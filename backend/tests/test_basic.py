"""Basic sanity tests – ensure core modules import without errors."""
from app.email_service import PROVIDER_SETTINGS
from app.oauth2_service import detect_provider


def test_provider_settings_keys():
    assert set(PROVIDER_SETTINGS.keys()) == {"outlook", "gmail", "firstmail", "custom"}


def test_detect_provider_gmail():
    assert detect_provider("test@gmail.com") == "gmail"


def test_detect_provider_outlook():
    assert detect_provider("test@hotmail.com") == "outlook"
    assert detect_provider("test@outlook.com") == "outlook"


def test_detect_provider_firstmail():
    assert detect_provider("test@firstmail.ltd") == "firstmail"


def test_detect_provider_custom():
    assert detect_provider("test@duhastmail.com") == "custom"
