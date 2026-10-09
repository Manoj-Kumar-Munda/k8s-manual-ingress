# ConfigMap and Secret (lab)

This project wires **ConfigMap** (non-sensitive config) and **Secret** (passwords) into Postgres and the Express backend.

## What lives where

| Resource | Namespace | Used by |
|---|---|---|
| `postgres-config` (ConfigMap) | `default` | Postgres Deployment |
| `postgres-secret` (Secret) | `default` | Postgres Deployment |
| `backend-config` (ConfigMap) | `backend-team` | Backend Deployment |
| `backend-db-secret` (Secret) | `backend-team` | Backend Deployment |

Postgres reads `POSTGRES_*` from `envFrom`. The backend reads `DB_*` and builds the connection string in `express/index.ts`.

The reverse-proxy nginx config is already a **ConfigMap** in `ops/reverse-proxy/manifest.yml` (`nginx-config`), mounted as a file instead of env vars.

## Apply order

```powershell
kubectl apply -f db\manifest.yml
kubectl apply -f backend\manifest.yml
```

## Inspect

```powershell
kubectl get configmap,secret -n default
kubectl get configmap,secret -n backend-team

kubectl describe configmap postgres-config
kubectl get secret postgres-secret -o jsonpath="{.data.POSTGRES_PASSWORD}" | ForEach-Object { [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($_)) }
```

Secrets are stored base64-encoded in the API; `stringData` in YAML is encoded for you on apply.

## Backend image

`express/index.ts` reads env vars when you build a new image:

```powershell
cd express
docker build -t your-registry/kubernetes-node:3 .
docker push your-registry/kubernetes-node:3
```

Update `image:` in `backend/manifest.yml`. Until then, the published image `manojkr999/kubernetes-node:2` still uses the built-in default connection string if env vars are missing.

## Production note

Plaintext passwords in Git are fine for learning only. In real clusters use Sealed Secrets, External Secrets, or a secret manager—and never commit production credentials.
