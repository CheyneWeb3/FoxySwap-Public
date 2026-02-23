Nice — here are **both versions** so you can send the one that fits.

---

## 1) Plain-language version for non-technical users

# Set up SSH login from Windows to Linux server (`10.0.0.61`)

This lets you log in by typing:

```powershell
ssh server1
```

instead of typing the full server address every time.

### What you need

* Your Linux username (the account on the server)
* The server SSH port (usually `22`)
* Your Windows PC

---

### Step A — Check if you already have an SSH key on Windows

Open **PowerShell** and run:

```powershell
dir $env:USERPROFILE\.ssh
```

If you see files like `id_ed25519` and `id_ed25519.pub`, you already have a key.

If not, create one:

```powershell
ssh-keygen -t ed25519
```

Press **Enter** through the prompts.

---

### Step B — Send your public key to the server

> Replace `LINUX_USER` with your Linux username.

If the server uses port **22**:

```powershell
scp $env:USERPROFILE\.ssh\id_ed25519.pub LINUX_USER@10.0.0.61:/tmp/windows_key.pub
```

If the server uses a custom port (example `2445`):

```powershell
scp -P 2445 $env:USERPROFILE\.ssh\id_ed25519.pub LINUX_USER@10.0.0.61:/tmp/windows_key.pub
```

---

### Step C — Log into the server once and install the key

If port **22**:

```powershell
ssh LINUX_USER@10.0.0.61
```

If custom port (example `2445`):

```powershell
ssh -p 2445 LINUX_USER@10.0.0.61
```

Now run this **on the Linux server**:

```bash
mkdir -p ~/.ssh
chmod 700 ~/.ssh
touch ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
cat /tmp/windows_key.pub >> ~/.ssh/authorized_keys
rm -f /tmp/windows_key.pub
```

---

### Step D — Create the shortcut (`ssh server1`)

On Windows, open your SSH config file:

```powershell
notepad $env:USERPROFILE\.ssh\config
```

Paste this (replace `LINUX_USER` and Windows username if needed):

```sshconfig
Host server1
  HostName 10.0.0.61
  User LINUX_USER
  IdentityFile C:\Users\<YourWindowsUser>\.ssh\id_ed25519
  IdentitiesOnly yes
```

If using a custom port, add a `Port` line:

```sshconfig
Host server1
  HostName 10.0.0.61
  User LINUX_USER
  Port 2445
  IdentityFile C:\Users\<YourWindowsUser>\.ssh\id_ed25519
  IdentitiesOnly yes
```

---

### Step E — Test it

```powershell
ssh server1
```

If it logs in, you’re done ✅

---

## 2) Admin/security version (clean handoff)

# Windows → Linux SSH key setup with `scp` (server `10.0.0.61`) + SSH alias `server1`

This procedure:

1. Verifies/generates a Windows SSH key pair
2. Uploads the public key to the Linux host with `scp`
3. Installs it into `~/.ssh/authorized_keys`
4. Creates a Windows OpenSSH host alias (`server1`)
5. Verifies key-based auth before any hardening changes

---

### 1. Verify or generate a key pair on Windows

Open **PowerShell**:

```powershell
dir $env:USERPROFILE\.ssh
```

Expected (recommended):

* `id_ed25519` (private key)
* `id_ed25519.pub` (public key)

If missing, generate:

```powershell
ssh-keygen -t ed25519
```

---

### 2. Upload the public key with `scp`

Replace:

* `LINUX_USER` = Linux account username
* `SSH_PORT` = actual SSH port (`22` if default)

**Port 22:**

```powershell
scp $env:USERPROFILE\.ssh\id_ed25519.pub LINUX_USER@10.0.0.61:/tmp/windows_key.pub
```

**Custom port (example 2445):**

```powershell
scp -P 2445 $env:USERPROFILE\.ssh\id_ed25519.pub LINUX_USER@10.0.0.61:/tmp/windows_key.pub
```

> Note: `scp` uses `-P` (capital P).

---

### 3. Install the public key on the Linux host

Log in once:

**Port 22**

```powershell
ssh LINUX_USER@10.0.0.61
```

**Custom port**

```powershell
ssh -p 2445 LINUX_USER@10.0.0.61
```

Run on Linux:

```bash
mkdir -p ~/.ssh
chmod 700 ~/.ssh
touch ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
cat /tmp/windows_key.pub >> ~/.ssh/authorized_keys
rm -f /tmp/windows_key.pub
```

Optional validation:

```bash
tail -n 1 ~/.ssh/authorized_keys
```

---

### 4. Test key authentication explicitly from Windows

**Port 22**

```powershell
ssh -i $env:USERPROFILE\.ssh\id_ed25519 LINUX_USER@10.0.0.61
```

**Custom port**

```powershell
ssh -i $env:USERPROFILE\.ssh\id_ed25519 -p 2445 LINUX_USER@10.0.0.61
```

Expected result: passwordless login (or key passphrase only).

---

### 5. Create Windows OpenSSH alias (`server1`)

Edit/create the config file:

```powershell
notepad $env:USERPROFILE\.ssh\config
```

**Port 22**

```sshconfig
Host server1
  HostName 10.0.0.61
  User LINUX_USER
  IdentityFile C:\Users\<YourWindowsUser>\.ssh\id_ed25519
  IdentitiesOnly yes
```

**Custom port**

```sshconfig
Host server1
  HostName 10.0.0.61
  User LINUX_USER
  Port 2445
  IdentityFile C:\Users\<YourWindowsUser>\.ssh\id_ed25519
  IdentitiesOnly yes
```

Test:

```powershell
ssh server1
```

---

### 6. Post-setup hardening (only after key login works)

If this is an admin-managed server, consider:

* disable password auth (`PasswordAuthentication no`)
* disable root SSH login (`PermitRootLogin no`)
* ensure pubkey auth enabled (`PubkeyAuthentication yes`)
* restrict SSH by firewall to approved IPs if possible
* keep a second active session open before restarting SSH

Restart service (Ubuntu/Debian usually):

```bash
sudo systemctl restart ssh
```

---

### 7. Common failure points

* Wrong file uploaded (must be `.pub`)
* Wrong key in SSH config (`IdentityFile` must be private key, no `.pub`)
* Wrong port flag (`scp -P`, `ssh -p`)
* Incorrect permissions (`~/.ssh` = 700, `authorized_keys` = 600)
* Key added to wrong Linux user account
* SSH daemon config disables pubkey auth
