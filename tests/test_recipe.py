"""Recipe generation has no consent gate or per-account request cap: Gemini's free tier is free to use."""


def test_gemini_requires_an_api_key_before_using_a_recipe_request(
    client, auth_headers, db, monkeypatch
):
    monkeypatch.delenv('GEMINI_API_KEY', raising=False)
    monkeypatch.setenv('OPENAI_API_KEY', 'old-key-does-not-enable-gemini')
    response = client.post('/api/recipe', headers=auth_headers, json={
        'session_id': 1, 'message': 'Make me a recipe',
    })
    # An invalid session is rejected before provider configuration is checked.
    assert response.status_code == 404

    user_id = db.execute("SELECT id FROM users WHERE email = ?", ('terp@example.com',)).fetchone()['id']
    now = '2026-10-09T12:00:00+00:00'
    session_id = db.execute(
        "INSERT INTO recipe_sessions (user_id, title, created_at, updated_at) "
        "VALUES (?, ?, ?, ?) RETURNING id",
        (user_id, 'Test recipe', now, now),
    ).fetchone()['id']
    db.commit()
    response = client.post('/api/recipe', headers=auth_headers, json={
        'session_id': session_id, 'message': 'Make me a recipe',
    })
    assert response.status_code == 503
    assert 'not configured' in response.json()['detail']
    assert db.execute('SELECT COUNT(*) AS n FROM recipe_messages').fetchone()['n'] == 0

    visible_error = client.post('/api/recipe', headers={
        **auth_headers, 'Origin': 'http://localhost:5173',
    }, json={
        'session_id': session_id, 'message': 'Make me a recipe',
    })
    assert visible_error.status_code == 503
    assert visible_error.headers['access-control-allow-origin'] == 'http://localhost:5173'


def test_gemini_client_uses_google_endpoint_and_key(monkeypatch):
    from src.api import recipe

    calls = []

    def fake_chat_openai(**kwargs):
        calls.append(kwargs)
        return object()

    monkeypatch.setenv('GEMINI_API_KEY', 'test-only-gemini-key')
    monkeypatch.setenv('GEMINI_MODEL', 'gemini-3.8-flash')
    monkeypatch.setattr(recipe, '_llm', None)
    monkeypatch.setattr(recipe, 'ChatOpenAI', fake_chat_openai)
    client = recipe._get_llm()
    assert client is recipe._get_llm()
    assert len(calls) == 1
    assert calls[0]['api_key'] == 'test-only-gemini-key'
    assert calls[0]['base_url'] == recipe.GEMINI_OPENAI_BASE_URL
    assert calls[0]['model'] == 'gemini-3.8-flash'


def test_failed_follow_up_removes_unsent_message(
    client, auth_headers, db, monkeypatch
):
    user_id = db.execute("SELECT id FROM users WHERE email = ?", ('terp@example.com',)).fetchone()['id']
    now = '2026-10-09T12:00:00+00:00'
    session_id = db.execute(
        "INSERT INTO recipe_sessions (user_id, title, created_at, updated_at) "
        "VALUES (?, ?, ?, ?) RETURNING id",
        (user_id, 'Test recipe', now, now),
    ).fetchone()['id']
    db.commit()

    class FailingLLM:
        def invoke(self, _messages):
            raise TimeoutError('simulated provider failure')

    monkeypatch.setattr('src.api.recipe._get_llm', lambda: FailingLLM())
    response = client.post('/api/recipe', headers=auth_headers, json={
        'session_id': session_id, 'message': 'Try a new recipe',
    })
    assert response.status_code == 502
    assert db.execute(
        'SELECT COUNT(*) AS n FROM recipe_messages WHERE session_id = ?',
        (session_id,),
    ).fetchone()['n'] == 0


def test_account_can_send_unlimited_recipe_requests(
    client, auth_headers, db, monkeypatch
):
    user_id = db.execute(
        "SELECT id FROM users WHERE email = ?", ('terp@example.com',)
    ).fetchone()['id']
    now = '2026-09-26T12:00:00+00:00'
    session_id = db.execute(
        "INSERT INTO recipe_sessions (user_id, title, created_at, updated_at) "
        "VALUES (?, ?, ?, ?) RETURNING id",
        (user_id, 'Test recipe', now, now),
    ).fetchone()['id']
    db.commit()

    calls = []

    class FakeLLM:
        def invoke(self, messages):
            calls.append(messages)
            return type('Response', (), {'content': 'A dining hall recipe.'})()

    monkeypatch.setattr('src.api.recipe._get_llm', lambda: FakeLLM())
    for attempt in range(1, 5):
        response = client.post('/api/recipe', headers=auth_headers, json={
            'session_id': session_id,
            'message': f'Please adjust recipe {attempt}',
        })
        assert response.status_code == 200, response.text

    assert len(calls) == 4
    assert db.execute(
        "SELECT COUNT(*) AS n FROM recipe_messages WHERE session_id = ?",
        (session_id,),
    ).fetchone()['n'] == 8
