# Ingress, IngressClass, and Ingress Controller

This folder is the Kubernetes Ingress version of the handmade nginx reverse proxy in `ops/reverse-proxy/`. The routing rules are the same:

| Host | Service | Port |
|---|---|---|
| `k8s-backend.manojdev.live` | `backend-service` (`backend-team`) | `3000` |
| `k8s-frontend.manojdev.live` | `frontend-service` (`frontend-team`) | `3000` |

An Ingress object is only a set of rules. It does not listen on a port by itself. You need three pieces:

1. **Ingress controller** — a proxy Deployment (ingress-nginx) plus a `LoadBalancer` Service. That Service is the public IP.
2. **IngressClass** — named `nginx` here. It tells the cluster which controller should implement which Ingress objects (`spec.ingressClassName: nginx`).
3. **Ingress** — `manifest.yml` in this folder. Host/path rules that point at ClusterIP Services.

Apply backend, frontend (and db if you need `/users`) before the Ingress.

```powershell
kubectl apply -f ..\db\manifest.yml
kubectl apply -f ..\backend\manifest.yml
kubectl apply -f ..\frontend\manifest.yml
```

Do not apply `ops/reverse-proxy/` at the same time unless you want two load balancers. Pick one public entrypoint.

---

## 1. Install the Ingress controller (creates the IngressClass)

Requires [Helm](https://helm.sh/) and `kubectl` pointed at the cluster.

```powershell
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm repo update ingress-nginx

helm upgrade --install ingress-nginx ingress-nginx/ingress-nginx `
  --namespace ingress-nginx `
  --create-namespace `
  --set controller.publishService.enabled=true `
  --set controller.ingressClassResource.default=true
```

What this creates:

- Namespace `ingress-nginx`
- Deployment `ingress-nginx-controller` (the controller)
- Service `ingress-nginx-controller` of type `LoadBalancer` (DigitalOcean assigns the public IP)
- IngressClass `nginx` (`kubernetes.io/ingress-nginx`)

`publishService.enabled=true` copies the LoadBalancer IP onto each Ingress `ADDRESS`. `ingressClassResource.default=true` makes `nginx` the default class if an Ingress omits `ingressClassName` (this repo still sets it explicitly).

Check:

```powershell
kubectl get ingressclass
kubectl rollout status deployment/ingress-nginx-controller -n ingress-nginx
kubectl get svc ingress-nginx-controller -n ingress-nginx
```

Wait until `EXTERNAL-IP` is a real address, not `<pending>`. That IP is what both domains should use.

---

## 2. Apply the Ingress rules

```powershell
kubectl apply -f manifest.yml
kubectl get ingress -A
```

`manifest.yml` defines two Ingress objects (one per namespace). Kubernetes Ingress can only reference a Service in the **same** namespace, so the backend and frontend rules cannot live in a single `default` Ingress.

Each object has:

```yaml
spec:
  ingressClassName: nginx
  rules:
    - host: k8s-backend.manojdev.live   # or k8s-frontend.manojdev.live
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: backend-service     # or frontend-service
                port:
                  number: 3000
```

`ADDRESS` should match the controller LoadBalancer IP.

---

## 3. Point the domains at the controller IP

```powershell
kubectl get svc ingress-nginx-controller -n ingress-nginx
```

Use `EXTERNAL-IP` (example: `174.138.122.117`).

**DNS:** two A records, both to that IP:

- `k8s-frontend.manojdev.live`
- `k8s-backend.manojdev.live`

**No DNS:** hosts file (`C:\Windows\System32\drivers\etc\hosts`):

```text
174.138.122.117  k8s-frontend.manojdev.live
174.138.122.117  k8s-backend.manojdev.live
```

Or send the Host header:

```powershell
curl -H "Host: k8s-frontend.manojdev.live" http://<EXTERNAL-IP>/
curl -H "Host: k8s-backend.manojdev.live" http://<EXTERNAL-IP>/users
```

Frontend is the Apache default page. Backend `/` is 404; `/users` is the Express route.

Opening `http://<EXTERNAL-IP>/` with no hostname will not match these hosts.

---

## 4. Uninstall the controller

```powershell
kubectl delete -f manifest.yml
helm uninstall ingress-nginx -n ingress-nginx
kubectl delete namespace ingress-nginx
```

DigitalOcean will release the load balancer after the Service is gone.

---

## Quick map

```text
Internet
  → Ingress controller LoadBalancer (EXTERNAL-IP)
    → ingress-nginx pod (IngressClass: nginx)
      → Ingress rules in manifest.yml
        → backend-service:3000  or  frontend-service:3000
```
