const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../app.js'), 'utf8');
const serviceSource = source.slice(
  source.indexOf('  function CommentService('),
  source.indexOf('  function AutomationService(')
);

function fixture(rows, rpcResponse, rejected = false) {
  const calls = { rpc: [], inserts: [] };
  const query = {
    select() { return this; },
    eq() { return this; },
    order() { return Promise.resolve({ data: rows }); },
    insert(payload) { calls.inserts.push(payload); return this; },
    single() { return Promise.resolve({ data: rows[0] }); }
  };
  const client = {
    from(table) { assert.equal(table, 'ticket_comments'); return query; },
    rpc(name, args) {
      calls.rpc.push({ name, args });
      return rejected ? Promise.reject(new Error('offline')) : Promise.resolve(rpcResponse);
    }
  };
  const context = { console: { warn() {} } };
  vm.runInNewContext(serviceSource + '\nthis.Service = CommentService;', context);
  return {
    service: context.Service({ when: x => Promise.resolve(x) }, {
      client, assertConfigured: () => Promise.resolve()
    }),
    calls
  };
}

test('resolves the official admin name for different passenger tickets', async () => {
  for (const ticketId of ['passenger-a-ticket', 'passenger-b-ticket']) {
    const { service, calls } = fixture([
      { id: 'old-comment', author_id: 'admin', author: null, content: 'Olá!' },
      { id: 'reply', author_id: 'passenger', author: { full_name: 'Ana Silva' } }
    ], { data: [{ author_id: 'admin', full_name: 'Administrador Sistema' }] });
    const rows = await service.fetchComments(ticketId);
    assert.equal(rows[0].author.full_name, 'Administrador Sistema');
    assert.equal(rows[0].author.id, 'admin');
    assert.equal(rows[0].content, 'Olá!');
    assert.equal(rows[1].author.full_name, 'Ana Silva');
    assert.equal(calls.rpc[0].name, 'get_ticket_comment_authors');
    assert.equal(calls.rpc[0].args.p_ticket_id, ticketId);
  }
});

test('preserves available names without an extra request', async () => {
  const { service, calls } = fixture([
    { author_id: 'agent', author: { full_name: 'Maria Souza' } }
  ]);
  assert.equal((await service.fetchComments('ticket'))[0].author.full_name, 'Maria Souza');
  assert.equal(calls.rpc.length, 0);
});

test('never attributes an unidentified author to the administrator', async () => {
  const { service } = fixture([{ author_id: 'deleted', author: null }], { data: [] });
  assert.equal((await service.fetchComments('ticket'))[0].author.full_name, 'Nome indisponível');
});

test('keeps messages visible when the name RPC is unavailable', async () => {
  for (const rejected of [false, true]) {
    const { service } = fixture([{ author_id: 'admin', content: 'Mensagem' }], {
      error: { code: 'PGRST202' }
    }, rejected);
    const rows = await service.fetchComments('ticket');
    assert.equal(rows[0].content, 'Mensagem');
    assert.equal(rows[0].author.full_name, 'Nome indisponível');
  }
});

test('a name lookup failure does not report a saved message as failed or resend it', async () => {
  const { service, calls } = fixture([{ id: 'saved', author_id: 'admin' }], {}, true);
  const saved = await service.addComment('ticket', 'admin', ' Olá! ');
  assert.equal(saved.id, 'saved');
  assert.equal(calls.inserts.length, 1);
  assert.equal(calls.inserts[0][0].content, 'Olá!');
});
