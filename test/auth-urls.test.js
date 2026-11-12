import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildAuthorizeUrl, parseRedirect, classifyAuthUrl, REDIRECT_URI, SCOPES } from '../src/main/auth-urls.js';

test('constants', () => {
  assert.equal(REDIRECT_URI, 'http://localhost/auth/callback');
  assert.deepEqual(SCOPES, ['user:read:follows']);
});

test('authorize URL', () => {
  const u = new URL(buildAuthorizeUrl({ clientId: 'abc', state: 's1' }));
  assert.equal(u.origin + u.pathname, 'https://id.twitch.tv/oauth2/authorize');
  assert.equal(u.searchParams.get('client_id'), 'abc');
  assert.equal(u.searchParams.get('redirect_uri'), 'http://localhost/auth/callback');
  assert.equal(u.searchParams.get('response_type'), 'token');
  assert.equal(u.searchParams.get('scope'), 'user:read:follows');
  assert.equal(u.searchParams.get('state'), 's1');
  assert.equal(u.searchParams.has('force_verify'), false);
});

test('force_verify on request', () => {
  const u = new URL(buildAuthorizeUrl({ clientId: 'abc', state: 's1', forceVerify: true }));
  assert.equal(u.searchParams.get('force_verify'), 'true');
});

test('valid redirect', () => {
  assert.deepEqual(
    parseRedirect('http://localhost/auth/callback#access_token=tok&scope=user%3Aread%3Afollows&state=s1&token_type=bearer', 's1'),
    { token: 'tok' },
  );
});

test('different state', () => {
  assert.ok(parseRedirect('http://localhost/auth/callback#access_token=tok&state=zz', 's1').error);
});

test('refusal', () => {
  assert.ok(parseRedirect('http://localhost/auth/callback?error=access_denied&state=s1', 's1').error);
});

test('missing token', () => {
  assert.ok(parseRedirect('http://localhost/auth/callback#state=s1', 's1').error);
});

test('page kinds', () => {
  assert.equal(classifyAuthUrl('http://localhost/auth/callback#x'), 'callback');
  assert.equal(classifyAuthUrl('https://id.twitch.tv/oauth2/authorize?client_id=a'), 'consent');
  assert.equal(classifyAuthUrl('https://www.twitch.tv/login?client_id=a'), 'login');
  assert.equal(classifyAuthUrl('https://accounts.google.com/o/oauth2/v2/auth'), 'login');
  assert.equal(classifyAuthUrl('https://example.com/'), 'other');
  assert.equal(classifyAuthUrl('pas une url'), 'other');
});

test('Google refusal inside an app is recognized', () => {
  assert.equal(classifyAuthUrl('https://accounts.google.com/v3/signin/rejected?continue=https%3A%2F%2Fx'), 'google-blocked');
  assert.equal(classifyAuthUrl('https://accounts.google.com/signin/rejected'), 'google-blocked');
  assert.equal(classifyAuthUrl('https://accounts.google.com/v3/signin/identifier?flowName=x'), 'login');
});
