# 🚀 OrkaFlow Frontend - Guia de Execução

## 📂 Caminhos importantes

**Projeto:**
/home/tharles.cunha/Projects/orkaflow-frontend

---

## 🌐 Frontend

**Servidor:** Vite  
**Host:** 0.0.0.0  
**Porta:** 5173  

### 🔗 Acesso

- Local:
http://localhost:5173

- Rede:
http://10.50.156.202:5173

---

## ⚙️ Serviço (systemd)

Arquivo: 
/etc/systemd/system/orkaflow-frontend.service


---

## ▶️ Comandos

### Iniciar
sudo systemctl start orkaflow-frontend

### Parar
sudo systemctl stop orkaflow-frontend

### Reiniciar
sudo systemctl restart orkaflow-frontend

### Status
sudo systemctl status orkaflow-frontend

### Logs
sudo journalctl -u orkaflow-frontend -f

---

## 🔄 Atualizar systemd
sudo systemctl daemon-reload

---

## 🔁 Auto start
sudo systemctl enable orkaflow-frontend

---

## ❌ Remover serviço

sudo systemctl stop orkaflow-frontend
sudo rm /etc/systemd/system/orkaflow-frontend.service
sudo systemctl daemon-reload

---

## 🧪 Execução manual

Rodar frontend:
npm run dev -- --host 0.0.0.0

---

## 🌍 Rede

### IP do servidor
10.50.156.202

### Liberar porta
sudo ufw allow 5173/tcp

---

## ⚠️ Observações

- Usa Vite (modo dev)
- Ideal para desenvolvimento
- Para produção usar build + nginx
- Ver logs em caso de erro

---

## ✅ Status esperado

VITE vX.X.X ready

Local:   http://localhost:5173/
Network: http://10.50.156.202:5173/

