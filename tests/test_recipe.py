"""Consent must be checked before saving or forwarding recipe conversations."""


def test_recipe_requires_explicit_ai_consent(client, auth_headers, db, monkeypatch):
    def unexpected_llm():
        raise AssertionError('No model call is allowed without consent')

    monkeypatch.setattr('src.api.recipe._get_llm', unexpected_llm)
    for payload in ({}, {'ai_consent': False}, {'session_id': 1, 'message': 'Follow up'}):
        response = client.post('/api/recipe', headers=auth_headers, json=payload)
        assert response.status_code == 400
        assert 'OpenAI' in response.json()['detail']
    assert db.execute('SELECT COUNT(*) AS n FROM recipe_sessions').fetchone()['n'] == 0
    usage = client.get('/api/recipe/usage', headers=auth_headers).json()
    assert usage == {'used': 0, 'limit': 3, 'remaining': 3}


def test_recipe_usage_requires_a_signed_in_account(client):
    response = client.get('/api/recipe/usage')
    assert response.status_code in (401, 403)


def test_account_can_send_only_three_consented_recipe_requests(
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
    for attempt in range(1, 4):
        response = client.post('/api/recipe', headers=auth_headers, json={
            'ai_consent': True,
            'session_id': session_id,
            'message': f'Please adjust recipe {attempt}',
        })
        assert response.status_code == 200, response.text

    rejected = client.post('/api/recipe', headers=auth_headers, json={
        'ai_consent': True,
        'session_id': session_id,
        'message': 'This fourth request must not be sent.',
    })
    assert rejected.status_code == 429
    assert len(calls) == 3
    assert db.execute(
        "SELECT COUNT(*) AS n FROM recipe_messages WHERE session_id = ?",
        (session_id,),
    ).fetchone()['n'] == 6
    assert client.get('/api/recipe/usage', headers=auth_headers).json() == {
        'used': 3, 'limit': 3, 'remaining': 0,
    }
