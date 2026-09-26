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
