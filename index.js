#!/usr/bin/env node
'use strict';

/*
 * FlightMapWorld MCP bridge.
 *
 * The FlightMapWorld MCP server is a remote one: https://flightmapworld.com/mcp
 * Clients that can connect to a URL should use that address directly. This
 * file is for clients that can only start a local program and talk to it over
 * standard input and output: it passes every message on to the remote server
 * and writes the answer back. It has no dependencies and keeps no state.
 *
 * Messages are JSON-RPC, one per line, as the MCP stdio transport defines.
 * Both generations of the protocol pass through: the one that opens with
 * `initialize` (up to 2025-11-25) and the one where every request names its
 * version in `_meta` (2026-07-28 and later).
 */

const ENDPOINT = process.env.FLIGHTMAPWORLD_MCP_URL || 'https://flightmapworld.com/mcp';
const VERSION_KEY = 'io.modelcontextprotocol/protocolVersion';
const HEADER_SAFE = /^[\x21-\x7e]([\x20-\x7e]*[\x21-\x7e])?$/;

if (typeof fetch !== 'function') {
  process.stderr.write('flightmapworld-mcp needs Node.js 18 or newer.\n');
  process.exit(1);
}

// The version agreed in `initialize`, sent as a header on later requests of that generation.
let negotiated = null;

function write(message) {
  process.stdout.write(JSON.stringify(message) + '\n');
}

function fail(id, code, text) {
  if (id !== undefined && id !== null) write({ jsonrpc: '2.0', id, error: { code, message: text } });
}

// Header values must be plain ASCII; anything else travels in the base64 form the specification defines.
function headerValue(value) {
  const text = String(value);
  return HEADER_SAFE.test(text) && !(text.startsWith('=?base64?') && text.endsWith('?='))
    ? text
    : '=?base64?' + Buffer.from(text, 'utf8').toString('base64') + '?=';
}

async function forward(message) {
  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json, text/event-stream',
    'User-Agent': 'flightmapworld-mcp-bridge/1.0',
  };
  const params = message && typeof message.params === 'object' && message.params !== null ? message.params : {};
  const stated = params._meta && typeof params._meta[VERSION_KEY] === 'string' ? params._meta[VERSION_KEY] : null;

  if (stated) {
    // Per-request metadata: the transport mirrors it into headers.
    headers['MCP-Protocol-Version'] = stated;
    if (typeof message.method === 'string') headers['Mcp-Method'] = message.method;
    const name = params.name !== undefined ? params.name : params.uri;
    if (name !== undefined) headers['Mcp-Name'] = headerValue(name);
  } else if (negotiated && message.method !== 'initialize') {
    headers['MCP-Protocol-Version'] = negotiated;
  }

  const response = await fetch(ENDPOINT, { method: 'POST', headers, body: JSON.stringify(message) });
  const text = await response.text();
  if (response.status === 202 || text.trim() === '') return; // a notification: nothing to answer

  let answer;
  try {
    answer = JSON.parse(text);
  } catch (error) {
    throw new Error('the server answered HTTP ' + response.status + ' with something that is not JSON');
  }
  if (message.method === 'initialize' && answer && answer.result && typeof answer.result.protocolVersion === 'string') {
    negotiated = answer.result.protocolVersion;
  }
  write(answer);
}

function handle(line) {
  const trimmed = line.trim();
  if (trimmed === '') return Promise.resolve();
  let message;
  try {
    message = JSON.parse(trimmed);
  } catch (error) {
    write({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } });
    return Promise.resolve();
  }
  return forward(message).catch((error) => {
    process.stderr.write('flightmapworld-mcp: ' + error.message + '\n');
    fail(message && message.id, -32603, 'Could not reach ' + ENDPOINT + ': ' + error.message);
  });
}

// Lines are handled one after another, so `initialize` is answered before what follows it.
let queue = Promise.resolve();
let buffer = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  buffer += chunk;
  let newline;
  while ((newline = buffer.indexOf('\n')) !== -1) {
    const line = buffer.slice(0, newline);
    buffer = buffer.slice(newline + 1);
    queue = queue.then(() => handle(line));
  }
});
process.stdin.on('end', () => {
  queue.then(() => handle(buffer)).then(() => process.exit(0));
});
