# Agent Commerce Discovery

## Decision

Expose public, read-only machine discovery without pretending that the site is
already an A2A server or that machine payments are live.

Assets:

- `/llms.txt` — concise LLM/agent-readable site description.
- `/agent-services.json` — structured catalog derived from the existing public
  service/pricing model.

## A2A

A2A v1.0 is the preferred future protocol for remote agent-to-agent
interoperability. The standard discovery location is
`/.well-known/agent-card.json`.

This repository intentionally does **not** publish an Agent Card in this
increment because the public site does not yet expose a conformant A2A messaging
interface. Publishing a card first would create a false capability claim.

## x402

The catalog may describe x402 as testnet preparation only. It does not include a
receiving wallet, payment authorization, settlement endpoint or mainnet support.
Real machine payments remain outside this increment.

## Source of pricing truth

Amounts in `agent-services.json` mirror
`commercial-runtime/src/service-pricing.mjs` at preparation time. CI must fail
if the JSON catalog drifts from that runtime catalog.
