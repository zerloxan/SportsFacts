# Deployment checklist — Kafka-native topology

Quick environment-setup checklist for running the AI service and gateway in
**Kafka-native mode** (AI service consumes/produces directly on Kafka, no
gateway HTTP hop). See the root [README](../README.md#optional-kafka-bus-redpanda)
and [apps/ai-service/README.md](../apps/ai-service/README.md#kafka-native-mode)
for how this mode works.

## 1. Start Redpanda

```bash
docker compose up -d redpanda    # single-node Redpanda on :9092
```

## 2. Set `KAFKA_BROKERS` on both services

```bash
export KAFKA_BROKERS=localhost:9092
```

Set this in the environment for **both** `apps/ai-service` and
`apps/gateway` — the gateway auto-provisions topics and switches its bus to
Kafka, and the AI service starts its Kafka consumer/producer.

## 3. Disable fact generation on the gateway

```bash
cd apps/gateway && GATEWAY_GENERATE_FACTS=false pnpm dev
```

Required in this mode — otherwise both the gateway and the AI service emit
facts for the same events.

## 4. (Optional) Override the AI service's consumer group

```bash
export KAFKA_GROUP_ID=ai-service   # default; override if running multiple instances
```

## 5. Start the AI service

```bash
cd apps/ai-service && .venv/Scripts/python -m uvicorn app.main:app --port 8000
```

## 6. Verify it's working

- `docker exec sportsfacts-redpanda rpk topic consume game.facts` — should
  show fact messages as the replay runs.
- `GET /health` on the gateway → `"bus": "kafka"`, `"facts": "relay"`.
- `GET /health` on the AI service → `ready: true` (requires
  `ANTHROPIC_API_KEY`).
- Redpanda console at <http://localhost:8080> to inspect topic offsets.
